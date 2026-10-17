<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Password\NewPasswordRules;
use App\Domain\User\Password\PasswordChangeMailer;
use App\Domain\User\Password\PasswordResolver;
use App\Domain\User\Password\PasswordSetting;
use App\Domain\User\UserRegistrar;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\PasswordSetCodeRepository;
use App\Repository\UserRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use ArrayObject;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\Decorator\EntityManagerDecorator;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use stdClass;
use Symfony\Component\Clock\Clock;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mime\Email;
use Symfony\Component\RateLimiter\LimiterInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\RateLimiter\Storage\InMemoryStorage;

final class SetPasswordTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a brand new passphrase';

    private const string SHORT = 'too short';

    private const string THIEFS = 'the thief chose this one';

    private const string ANOTHER = 'a second passphrase now';

    private const string ADDRESS = 'google-only@example.com';

    private string $refreshToken = '';

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime('2026-10-17 12:00:00');
        $registered = self::service(UserRegistrar::class)->registerFromProvider(self::ADDRESS, 'Kemi');
        self::onboard($registered->user);
        $this->refreshToken = Type\string()->coerce($registered->tokens->refreshToken);
    }

    #[Test]
    public function theCodeFirstThenThePasswordAndNoSessionIsEnded(): void
    {
        $this->call('POST', '/api/auth/password/set', ['newPassword' => self::PASSWORD, 'stepUp' => 'made-up']);
        self::assertSame(ErrorCode::VerificationCodeExpired->type(), $this->last()['type'], 'no password before the code');

        self::assertSame(['cooldownSeconds' => 60], $this->call('POST', '/api/auth/password/set/start'));
        $stepUp = $this->passed($this->codeSent());

        $this->call('POST', '/api/auth/password/set', ['newPassword' => self::SHORT, 'stepUp' => $stepUp]);
        self::assertSame(422, $this->statusCode());
        self::assertSame('newPassword', $this->last()['violations'][0]['propertyPath'] ?? null);

        $this->call('POST', '/api/auth/password/set', ['newPassword' => self::PASSWORD, 'stepUp' => $stepUp]);
        self::assertSame(204, $this->statusCode());
        self::assertTrue(self::service(PasswordResolver::class)->verify($this->account(), self::PASSWORD));
        self::assertTrue($this->call('GET', '/api/auth/me')['hasPassword']);

        $this->call('POST', '/api/auth/refresh', ['refreshToken' => $this->refreshToken], signedIn: false);
        self::assertSame(200, $this->statusCode(), 'nothing was replaced, so no session ended');
        $this->call('POST', '/api/auth/login', ['email' => self::ADDRESS, 'password' => self::PASSWORD], signedIn: false);
        self::assertSame(200, $this->statusCode(), 'it now signs in with the password too');
    }

    #[Test]
    public function aWrongCodeIsWrongTheFifthSpendsItAndAResendWaitsForTheCooldown(): void
    {
        $this->call('POST', '/api/auth/password/set/start');
        $this->call('POST', '/api/auth/password/set/start');
        self::assertSame(429, $this->statusCode(), 'a resend waits out the cooldown');
        self::assertGreaterThan(0, (int) $this->client->getResponse()->headers->get('Retry-After'));

        for ($try = 1; $try <= 5; ++$try) {
            $this->call('POST', '/api/auth/password/set/code', ['code' => '000000']);
        }

        self::assertSame(ErrorCode::VerificationCodeExhausted->type(), $this->last()['type'], 'the fifth spends it');
        self::assertTrue(self::service(PasswordSetCodeRepository::class)->findOneForUser($this->account())?->isExhausted());

        $this->call('POST', '/api/auth/password/set', ['newPassword' => self::PASSWORD, 'stepUp' => 'made-up']);
        self::assertSame(ErrorCode::VerificationCodeExpired->type(), $this->last()['type'], 'a spent code passes nothing');
    }

    /** Both sends run after the response, so the language each was asked in is carried to it. */
    #[Test]
    public function theCodeAndTheNoticeSpeakTheLanguageTheyWereAskedIn(): void
    {
        $this->call('POST', '/api/auth/password/set/start', server: ['HTTP_ACCEPT_LANGUAGE' => 'pt']);
        self::assertSame('O seu código da Soirely', $this->lastMail()->getSubject());

        $stepUp = $this->passed($this->codeSent());
        $this->call('POST', '/api/auth/password/set', ['newPassword' => self::PASSWORD, 'stepUp' => $stepUp], server: ['HTTP_ACCEPT_LANGUAGE' => 'pt']);
        self::assertSame('Foi adicionada uma palavra-passe à sua conta Soirely', $this->lastMail()->getSubject());
    }

    /** OWASP ASVS V2.5: the code proves the requester, not the account, so another session cannot spend the pass. */
    #[Test]
    public function anotherSessionCannotSpendThePassAndATokenWorksOnce(): void
    {
        $this->call('POST', '/api/auth/password/set/start');
        $stepUp = $this->passed($this->codeSent());

        foreach ([[], ['stepUp' => ''], ['stepUp' => Str\repeat('0', 64)]] as $stolen) {
            $this->call('POST', '/api/auth/password/set', ['newPassword' => self::THIEFS, ...$stolen]);
            self::assertContains($this->statusCode(), [410, 422], 'a session without the token sets nothing');
        }

        self::assertNull($this->account()->getPassword());

        $this->call('POST', '/api/auth/password/set', ['newPassword' => self::PASSWORD, 'stepUp' => $stepUp]);
        self::assertSame(204, $this->statusCode(), 'and the wrong ones burned nothing');
        $this->call('POST', '/api/auth/password/set', ['newPassword' => self::ANOTHER, 'stepUp' => $stepUp]);
        self::assertSame(409, $this->statusCode(), 'a token works once');
        self::assertTrue(self::service(PasswordResolver::class)->verify($this->account(), self::PASSWORD));
    }

    #[Test]
    public function anAccountWithAPasswordHasNothingToAdd(): void
    {
        $user = $this->account();
        $user->setPassword(self::service(PasswordResolver::class)->hash(self::PASSWORD));
        self::em()->flush();

        $this->call('POST', '/api/auth/password/set/start');

        self::assertSame(409, $this->statusCode());
        self::assertCount(0, self::getMailerMessages(), 'no code was sent');
    }

    #[Test]
    public function theAddressIsToldAPasswordWasAddedAndFromWhere(): void
    {
        $this->call('POST', '/api/auth/password/set/start');
        $stepUp = $this->passed($this->codeSent());

        $this->call('POST', '/api/auth/password/set', ['newPassword' => self::PASSWORD, 'stepUp' => $stepUp], server: ['HTTP_USER_AGENT' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', 'REMOTE_ADDR' => '102.89.33.14']);

        $mail = $this->lastMail();
        $text = (string) $mail->getTextBody();
        self::assertSame('A password was added to your Soirely account', $mail->getSubject());
        self::assertStringContainsString('The device: Safari on iPhone, from 102.89.33.14.', $text);
        self::assertStringNotContainsString(self::PASSWORD, $text);
    }

    /** Five wrong codes per account however many are sent, and the row lock is taken before the budget is peeked. */
    #[Test]
    public function theBudgetHoldsAcrossResendsUnderTheAccountsLock(): void
    {
        $log = new ArrayObject();
        $setting = $this->setting($log);
        $user = $this->account();

        $setting->sendCode($user);
        $this->spendWrong($setting, $user, 3);
        self::mockTime('+61 seconds');
        $setting->sendCode($user);
        $this->spendWrong($setting, $user, 2);

        try {
            $setting->passCode($user, '000000');
            self::fail('a sixth wrong code across two emails was checked');
        } catch (ApiException $e) {
            self::assertSame(ErrorCode::TooManyAttempts, $e->errorCode);
        }

        self::assertSame(['locked', 'peeked'], Vec\take($log->getArrayCopy(), 2), 'SELECT … FOR UPDATE before the budget is peeked');
    }

    private function spendWrong(PasswordSetting $setting, User $user, int $times): void
    {
        for ($try = 0; $try < $times; ++$try) {
            try {
                $setting->passCode($user, '000000');
            } catch (ApiException $e) {
                self::assertSame(ErrorCode::VerificationCodeInvalid, $e->errorCode);
            }
        }
    }

    /** @param ArrayObject<int, string> $log */
    private function setting(ArrayObject $log): PasswordSetting
    {
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
                $this->real = new RateLimiterFactory(['id' => 'set', 'policy' => 'fixed_window', 'limit' => 5, 'interval' => '15 minutes'], new InMemoryStorage());
            }

            public function create(?string $key = null): LimiterInterface
            {
                $this->log->append('peeked');

                return $this->real->create($key);
            }
        };

        return new PasswordSetting(
            self::service(PasswordSetCodeRepository::class),
            self::service(PasswordResolver::class),
            self::service(NewPasswordRules::class),
            self::service(PasswordChangeMailer::class),
            self::service(AfterResponse::class),
            $em,
            new Clock(),
            $budget,
        );
    }

    private function passed(string $code): string
    {
        $body = $this->call('POST', '/api/auth/password/set/code', ['code' => $code]);
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\string()->coerce($body['stepUp'] ?? null);
    }

    private function codeSent(): string
    {
        return Regex\first_match((string) $this->lastMail()->getTextBody(), '/\b(\d{6})\b/')[1] ?? '';
    }

    private function lastMail(): Email
    {
        return Type\instance_of(Email::class)->coerce(Iter\last(self::getMailerMessages()));
    }

    private function account(): User
    {
        return Type\instance_of(User::class)->coerce(self::service(UserRepository::class)->findOneByPrimaryEmailAddress(self::ADDRESS));
    }

    /**
     * @param array<string, mixed>|null $body
     * @param array<string, string>     $server
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, ?array $body = null, bool $signedIn = true, array $server = []): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => $signedIn ? 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->account()) : '',
            ...$server,
        ], content: Json\encode($body ?? new stdClass()));

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
