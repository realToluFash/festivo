<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Password\NewPasswordRules;
use App\Domain\User\Password\PasswordChange;
use App\Domain\User\Password\PasswordChangeMailer;
use App\Domain\User\Password\PasswordResolver;
use App\Domain\User\Password\ScriptedBreachedPasswordChecker;
use App\Domain\User\TokenIssuer;
use App\Domain\User\UserRegistrar;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\RefreshTokenRepository;
use App\Repository\UserRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use ArrayObject;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\Decorator\EntityManagerDecorator;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use stdClass;
use Symfony\Component\Clock\NativeClock;
use Symfony\Component\Mime\Email;
use Symfony\Component\RateLimiter\LimiterInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\RateLimiter\Storage\InMemoryStorage;
use Symfony\Contracts\Translation\TranslatorInterface;

final class ChangePasswordTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string OLD_PASSWORD = 'the old passphrase';

    /** @mago-expect lint:no-literal-password */
    private const string NEW_PASSWORD = 'a brand new passphrase';

    private const string ADDRESS = 'folake@example.com';

    private const string WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::onboard(self::service(UserRegistrar::class)->register(self::ADDRESS, 'Folake', self::OLD_PASSWORD)->user);
    }

    #[Test]
    public function theRightCurrentPasswordChangesItAndEndsEveryOtherSessionButThisOne(): void
    {
        $here = $this->signIn();
        $elsewhere = $this->signIn();
        $farAway = $this->signIn();

        $others = Iter\count(self::service(RefreshTokenRepository::class)->findUsableFor($this->account())) - 1;

        $body = $this->change($here, self::OLD_PASSWORD, self::NEW_PASSWORD);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame(['signedOut' => $others], $body, 'the count is the sessions it ended');
        self::assertCount(1, self::service(RefreshTokenRepository::class)->findUsableFor($this->account()), 'only this one is left');

        $this->call('POST', '/api/auth/refresh', ['refreshToken' => $here['refreshToken']]);
        self::assertSame(200, $this->statusCode(), 'this device stays signed in, through its next refresh');

        foreach ([$elsewhere, $farAway] as $other) {
            $this->call('POST', '/api/auth/refresh', ['refreshToken' => $other['refreshToken']]);
            self::assertSame(401, $this->statusCode(), 'another device is signed out');
        }

        $this->call('POST', '/api/auth/login', ['email' => self::ADDRESS, 'password' => self::OLD_PASSWORD]);
        self::assertSame(401, $this->statusCode(), 'the old password no longer works');
        $this->call('POST', '/api/auth/login', ['email' => self::ADDRESS, 'password' => self::NEW_PASSWORD]);
        self::assertSame(200, $this->statusCode(), 'the new one does');
    }

    #[Test]
    public function aWrongCurrentPasswordChangesNothing(): void
    {
        $here = $this->signIn();
        $elsewhere = $this->signIn();

        $this->change($here, 'not the password at all', self::NEW_PASSWORD);

        self::assertSame(401, $this->statusCode());
        self::assertSame(ErrorCode::InvalidCredentials->type(), $this->last()['type']);
        self::assertTrue(self::service(PasswordResolver::class)->verify($this->account(), self::OLD_PASSWORD));
        $this->call('POST', '/api/auth/refresh', ['refreshToken' => $elsewhere['refreshToken']]);
        self::assertSame(200, $this->statusCode(), 'no session was ended');
        self::assertCount(0, self::getMailerMessages(), 'nothing was emailed');
    }

    #[Test]
    public function aNewPasswordIsHeldToTheRegistrationRulesOnItsOwnField(): void
    {
        $here = $this->signIn();

        $this->change($here, self::OLD_PASSWORD, 'too short');
        self::assertSame(422, $this->statusCode());
        self::assertSame([['newPassword', 'password_too_short']], $this->violations());

        $this->change($here, self::OLD_PASSWORD, ScriptedBreachedPasswordChecker::KNOWN[0]);
        self::assertSame(422, $this->statusCode());
        self::assertSame([['newPassword', 'password_breached']], $this->violations());

        $this->change($here, self::OLD_PASSWORD, self::OLD_PASSWORD);
        self::assertSame(422, $this->statusCode());
        self::assertSame([['newPassword', 'password_unchanged']], $this->violations());
        self::assertSame('That is already your password. Choose a different one.', $this->last()['violations'][0]['message'] ?? null);

        self::assertTrue(self::service(PasswordResolver::class)->verify($this->account(), self::OLD_PASSWORD), 'nothing changed');
    }

    #[Test]
    public function fiveWrongCurrentPasswordsPauseItAndSayUntilWhen(): void
    {
        $change = $this->passwordChange();
        $user = $this->account();

        for ($try = 0; $try < 5; ++$try) {
            try {
                $change->change($user, 'not the password at all', self::NEW_PASSWORD);
                self::fail('a wrong current password was accepted');
            } catch (ApiException $e) {
                self::assertSame(ErrorCode::InvalidCredentials, $e->errorCode);
            }
        }

        try {
            $change->change($user, self::OLD_PASSWORD, self::NEW_PASSWORD);
            self::fail('the sixth try was let through');
        } catch (ApiException $e) {
            self::assertSame(ErrorCode::TooManyAttempts, $e->errorCode, 'even the right one waits');
            self::assertArrayHasKey('Retry-After', $e->headers, 'and it says until when');
        }

        self::assertTrue(self::service(PasswordResolver::class)->verify($this->account(), self::OLD_PASSWORD), 'nothing changed');
    }

    /** A row lock taken around the check is what makes parallel guesses queue behind the budget. */
    #[Test]
    public function theAccountRowIsLockedForTheWholeCheck(): void
    {
        $log = new ArrayObject();
        $em = new class(self::em(), $log) extends EntityManagerDecorator {
            /** @param ArrayObject<int, string> $log */
            public function __construct(EntityManagerInterface $wrapped, private readonly ArrayObject $log)
            {
                parent::__construct($wrapped);
            }

            public function refresh(object $object, LockMode|int|null $lockMode = null): void
            {
                $this->log->append(LockMode::PESSIMISTIC_WRITE === $lockMode ? 'locked' : 'refreshed');
                parent::refresh($object, $lockMode);
            }
        };
        $budget = new class($log) implements RateLimiterFactoryInterface {
            private RateLimiterFactory $real;

            /** @param ArrayObject<int, string> $log */
            public function __construct(private readonly ArrayObject $log)
            {
                $this->real = new RateLimiterFactory(['id' => 'change', 'policy' => 'fixed_window', 'limit' => 5, 'interval' => '15 minutes'], new InMemoryStorage());
            }

            public function create(?string $key = null): LimiterInterface
            {
                $this->log->append('peeked');

                return $this->real->create($key);
            }
        };

        $this->passwordChange(em: $em, budget: $budget)->change($this->account(), self::OLD_PASSWORD, self::NEW_PASSWORD);

        self::assertSame(['locked', 'peeked'], $log->getArrayCopy(), 'SELECT … FOR UPDATE on the account before the budget is peeked');
    }

    #[Test]
    public function theAddressIsToldWhenAndFromWhatDeviceAndNothingElse(): void
    {
        $here = $this->signIn();

        $this->change($here, self::OLD_PASSWORD, self::NEW_PASSWORD, ['HTTP_USER_AGENT' => self::WINDOWS_CHROME, 'REMOTE_ADDR' => '197.210.78.3']);

        $mail = Type\instance_of(Email::class)->coerce(Iter\last(self::getMailerMessages()));
        $text = (string) $mail->getTextBody();
        self::assertSame(self::ADDRESS, $mail->getTo()[0]->getAddress());
        self::assertSame('Your Soirely password was changed', $mail->getSubject());
        self::assertStringContainsString('The device: Chrome on Windows, from 197.210.78.3.', $text);
        self::assertStringContainsString('"Forgot your password?"', $text);
        self::assertStringNotContainsString(self::OLD_PASSWORD, $text);
        self::assertStringNotContainsString(self::NEW_PASSWORD, $text);
        self::assertCount(1, Regex\every_match($text, '#https?://#') ?? [], 'one link, and only to sign-in');
        self::assertStringContainsString('/sign-in', $text);
    }

    /** A decomposed é hashed through the resolver verifies as the composed one, which "sign-in works" with ASCII never proves. */
    #[Test]
    public function theNewPasswordGoesThroughTheSameNormalisationAsSignIn(): void
    {
        $decomposed = "cafe\u{0301} au lait at dawn";
        $composed = "caf\u{00E9} au lait at dawn";

        $this->change($this->signIn(), self::OLD_PASSWORD, $decomposed);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertTrue(self::service(PasswordResolver::class)->verify($this->account(), $composed));
    }

    private function passwordChange(?NewPasswordRules $rules = null, ?EntityManagerInterface $em = null, ?RateLimiterFactoryInterface $budget = null): PasswordChange
    {
        return new PasswordChange(
            self::service(PasswordResolver::class),
            $rules ?? self::service(NewPasswordRules::class),
            self::service(TokenIssuer::class),
            self::service(PasswordChangeMailer::class),
            self::service(AfterResponse::class),
            $em ?? self::em(),
            self::service(TranslatorInterface::class),
            new NativeClock(),
            $budget ?? new RateLimiterFactory(['id' => 'change', 'policy' => 'fixed_window', 'limit' => 5, 'interval' => '15 minutes'], new InMemoryStorage()),
        );
    }

    /** @return array{accessToken: string, refreshToken: string, sessionId: string} */
    private function signIn(): array
    {
        $body = $this->call('POST', '/api/auth/login', ['email' => self::ADDRESS, 'password' => self::OLD_PASSWORD]);
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        $issued = Type\shape(['accessToken' => Type\string(), 'refreshToken' => Type\string(), 'sessionId' => Type\string()], true)->coerce($body);

        return ['accessToken' => $issued['accessToken'], 'refreshToken' => $issued['refreshToken'], 'sessionId' => $issued['sessionId']];
    }

    /**
     * @param array{accessToken: string, refreshToken: string, sessionId: string} $session
     * @param array<string, string>                                               $server
     *
     * @return array<string, mixed>
     */
    private function change(array $session, #[SensitiveParameter] string $current, #[SensitiveParameter] string $new, array $server = []): array
    {
        $this->client->request('PATCH', '/api/auth/password', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $session['accessToken'],
            ...$server,
        ], content: Json\encode(['currentPassword' => $current, 'newPassword' => $new, 'sessionId' => $session['sessionId']]));

        return $this->last();
    }

    /** @return list<array{0: mixed, 1: mixed}> */
    private function violations(): array
    {
        $violations = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->last()['violations'] ?? []);

        return Vec\map($violations, static fn (array $v): array => [$v['propertyPath'] ?? null, $v['code'] ?? null]);
    }

    private function account(): User
    {
        self::em()->clear();

        return Type\instance_of(User::class)->coerce(self::service(UserRepository::class)->findOneByPrimaryEmailAddress(self::ADDRESS));
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, ?array $body = null): array
    {
        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
        $this->client->request($method, $path, server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode($body ?? new stdClass()));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
