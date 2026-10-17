<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Controller\RegisterController;
use App\Domain\User\Http\AccountSerialiser;
use App\Domain\User\Password\PasswordPolicy;
use App\Domain\User\Password\PasswordResolver;
use App\Domain\User\Password\ScriptedBreachedPasswordChecker;
use App\Domain\User\Registration\PendingRegistrations;
use App\Domain\User\UserRegistrar;
use App\Entity\RefreshToken;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\UserRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\RefusingRateLimiterFactory;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Math;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mime\Email;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

final class RegisterTest extends ApiTestCase
{
    use ClockSensitiveTrait;

    /**
     * A literal password, which is the one thing a registration test cannot do
     * without. The rule is right everywhere else: a credential in source is a
     * credential in every clone of the repository.
     *
     * @mago-expect lint:no-literal-password
     */
    private const string GOOD_PASSWORD = 'a decent passphrase';

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
    }

    /** The same status, shape and handle for a new address and one an account holds (OWASP Authentication Cheat Sheet). */
    #[Test]
    public function aNewAndATakenAddressGetTheSameAnswer(): void
    {
        $this->owner('taken@example.com');

        $new = $this->register('New.Person@Example.COM  ', 'Ada Lovelace', self::GOOD_PASSWORD);
        $newStatus = $this->statusCode();
        $taken = $this->register('taken@example.com', 'Somebody else', self::GOOD_PASSWORD);

        self::assertSame(202, $newStatus);
        self::assertSame(202, $this->statusCode());
        self::assertSame(['registration', 'email'], Vec\keys($new));
        self::assertSame(['registration', 'email'], Vec\keys($taken));
        self::assertMatchesRegularExpression('/^[0-9a-f]{64}$/', Type\string()->coerce($new['registration']));
        self::assertMatchesRegularExpression('/^[0-9a-f]{64}$/', Type\string()->coerce($taken['registration']));
        self::assertSame('new.person@example.com', $new['email']);
        self::assertNull(self::service(UserRepository::class)->findOneByPrimaryEmailAddress('new.person@example.com'), 'no account until the code');
    }

    /** Measured without the email, which goes after the answer: both hash the password, so both cost the same. */
    #[Test]
    public function aTakenAddressAnswersInTheTimeANewOneDoes(): void
    {
        $this->owner('taken@example.com');
        $registrations = self::service(PendingRegistrations::class);
        $time = static function (callable $attempt): float {
            $start = \hrtime(true);
            $attempt();

            return (\hrtime(true) - $start) / 1e6;
        };

        $new = $time(static fn () => $registrations->start('fresh@example.com', 'Fresh', self::GOOD_PASSWORD, 'en'));
        $taken = $time(static fn () => $registrations->start('taken@example.com', 'Taken', self::GOOD_PASSWORD, 'en'));

        self::assertLessThan(2.0, Math\maxva($new, $taken) / Math\maxva(1.0, Math\minva($new, $taken)), Str\format('new %.1fms, taken %.1fms', $new, $taken));
    }

    #[Test]
    public function theAccountIsMadeOnlyByTheCodeAndThenSignedIn(): void
    {
        $handle = Type\string()->coerce($this->register('ada@example.com', 'Ada', self::GOOD_PASSWORD)['registration']);
        $code = $this->codeSentTo('ada@example.com');

        $this->client->request('POST', '/api/auth/login', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['email' => 'ada@example.com', 'password' => self::GOOD_PASSWORD]));
        self::assertSame(401, $this->statusCode(), 'no account to sign in to yet');
        self::assertSame(ErrorCode::InvalidCredentials->type(), $this->last()['type']);

        $body = $this->confirm($handle, $code);

        self::assertSame(201, $this->statusCode(), Json\encode($body));
        self::assertIsString($body['accessToken'] ?? null);
        self::assertStringNotContainsString(self::GOOD_PASSWORD, (string) $this->client->getResponse()->getContent());
        $user = self::service(UserRepository::class)->findOneByPrimaryEmailAddress('ada@example.com');
        self::assertNotNull($user);
        self::assertTrue($user->hasVerifiedEmailAddress(), 'the code proved the address');
        self::assertTrue(self::service(PasswordResolver::class)->verify($user, self::GOOD_PASSWORD));
        self::assertSame(1, self::em()->getRepository(RefreshToken::class)->count([]), 'signed in once, by the code');
    }

    #[Test]
    public function aTakenAddressGetsNoCodeAndItsOwnerAnEmailAtMostHourly(): void
    {
        self::mockTime('2026-10-17 12:00:00');
        $this->owner('taken@example.com');

        $handle = Type\string()->coerce($this->register('  TAKEN@Example.com ', 'Somebody', self::GOOD_PASSWORD)['registration']);
        $mail = $this->lastMail();
        self::assertSame('taken@example.com', $mail->getTo()[0]->getAddress(), 'the address is normalised before the check');
        self::assertSame('You already have a Soirely account', $mail->getSubject());
        self::assertStringContainsString('/forgot-password', (string) $mail->getTextBody());

        foreach (['000000', '123456'] as $guess) {
            $this->confirm($handle, $guess);
            self::assertSame(ErrorCode::VerificationCodeInvalid->type(), $this->last()['type'], 'every code reads as wrong');
        }
        self::assertSame(1, self::service(UserRepository::class)->count([]), 'no second account');

        self::mockTime('+2 minutes');
        $this->resend($handle);
        self::assertSame(200, $this->statusCode());
        self::assertCount(0, self::getMailerMessages(), 'not again within the hour');

        self::mockTime('+61 minutes');
        $this->resend($handle);
        self::assertSame('You already have a Soirely account', $this->lastMail()->getSubject(), 'and again after it');
    }

    /** A taken address reads exactly as a new one does, so opening the screen tells nobody which it is. */
    #[Test]
    public function theScreenReadsWhetherTheCodeIsLiveExhaustedOrExpired(): void
    {
        self::mockTime('2026-10-17 12:00:00');
        $this->owner('taken@example.com');

        foreach (['fresh@example.com', 'taken@example.com'] as $address) {
            $handle = Type\string()->coerce($this->register($address, 'Someone', self::GOOD_PASSWORD)['registration']);
            self::assertSame('live', $this->opening($handle)['codeState'], $address);

            for ($attempt = 0; $attempt < VerificationChallenge::MAXIMUM_ATTEMPTS; ++$attempt) {
                $this->confirm($handle, '000000');
            }

            self::assertSame('exhausted', $this->opening($handle)['codeState'], $address);
            self::assertSame(['cooldownSeconds', 'codeState'], Vec\keys($this->last()));
        }

        $later = Type\string()->coerce($this->register('later@example.com', 'Later', self::GOOD_PASSWORD)['registration']);
        self::mockTime('+16 minutes');
        self::assertSame('expired', $this->opening($later)['codeState']);
    }

    #[Test]
    public function aHandleWorksOnceAndForADay(): void
    {
        self::mockTime('2026-10-17 12:00:00');
        $handle = Type\string()->coerce($this->register('once@example.com', 'Once', self::GOOD_PASSWORD)['registration']);
        $code = $this->codeSentTo('once@example.com');
        $this->confirm($handle, $code);
        self::assertSame(201, $this->statusCode());

        $this->confirm($handle, $code);
        self::assertSame(ErrorCode::RegistrationExpired->type(), $this->last()['type'], 'a second press of the right code: used, not a conflict');

        $later = Type\string()->coerce($this->register('later@example.com', 'Later', self::GOOD_PASSWORD)['registration']);
        self::mockTime('+25 hours');
        $this->confirm($later, '000000');
        self::assertSame(410, $this->statusCode());
        self::assertSame(ErrorCode::RegistrationExpired->type(), $this->last()['type'], 'expired');
    }

    #[Test]
    public function anAddressHeldByAnUnverifiedAccountIsReleasedOnceTheCodeProvesIt(): void
    {
        $mistyped = self::service(UserRegistrar::class)->register('released@example.com', 'Mistyped', self::GOOD_PASSWORD)->user;
        $mistypedId = $mistyped->getId();
        self::em()->clear();

        $handle = Type\string()->coerce($this->register('released@example.com', 'Real owner', self::GOOD_PASSWORD)['registration']);
        self::assertNotNull(self::em()->find(User::class, $mistypedId), 'nothing changes until the code');

        $this->confirm($handle, $this->codeSentTo('released@example.com'));

        self::assertSame(201, $this->statusCode());
        self::assertNull(self::em()->find(User::class, $mistypedId), 'the unverified holder was released');
    }

    /** "Not your address?" starts again: a fresh handle, and the old one still answers only for itself. */
    #[Test]
    public function registeringAgainGivesAFreshHandle(): void
    {
        $first = $this->register('again@example.com', 'Again', self::GOOD_PASSWORD)['registration'];
        $second = $this->register('again@example.com', 'Again', self::GOOD_PASSWORD)['registration'];

        self::assertNotSame($first, $second);
    }

    #[Test]
    public function aShortPasswordIsRefusedAgainstTheField(): void
    {
        $body = $this->register('short@example.com', 'Short', 'abc');

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertSame(ErrorCode::ValidationFailed->type(), $body['type']);
        self::assertSame(
            [['propertyPath' => 'password', 'code' => 'password_too_short']],
            self::pairs($body['violations']),
        );
        self::assertStringContainsString(
            (string) PasswordPolicy::MINIMUM_LENGTH,
            $body['violations'][0]['message'],
            'the message states the number rather than saying "too short"',
        );
    }

    #[Test]
    public function aBreachedPasswordIsRefusedAgainstTheField(): void
    {
        $breached = ScriptedBreachedPasswordChecker::KNOWN[0];

        self::assertSame([], PasswordPolicy::check($breached), 'precondition: long enough to reach the corpus');

        $body = $this->register('breached@example.com', 'Breached', $breached);

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertSame(
            [['propertyPath' => 'password', 'code' => 'password_breached']],
            self::pairs($body['violations']),
        );
    }

    #[Test]
    public function aPasswordTooShortIsNotSentToTheCorpus(): void
    {
        // Short AND breached. Only the length failure comes back, which is how
        // the ordering shows: the corpus is never asked about a password that
        // is already refused.
        $body = $this->register('both@example.com', 'Both', 'letmein');

        self::assertSame(
            [['propertyPath' => 'password', 'code' => 'password_too_short']],
            self::pairs($body['violations']),
        );
    }

    #[Test]
    #[DataProvider('badAddresses')]
    public function anAddressThatIsNotOneIsRefused(string $email): void
    {
        $body = $this->register($email, 'Name', self::GOOD_PASSWORD);

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertContains(
            ['propertyPath' => 'email', 'code' => 'validation_failed'],
            self::pairs($body['violations']),
        );
    }

    /** @return iterable<string, array{string}> */
    public static function badAddresses(): iterable
    {
        yield 'empty' => [''];
        yield 'no at sign' => ['not-an-address'];
        yield 'no domain' => ['person@'];
        yield 'spaces only' => ['   '];
    }

    #[Test]
    public function aMissingNameIsRefused(): void
    {
        $body = $this->register('noname@example.com', '   ', self::GOOD_PASSWORD);

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertContains(
            ['propertyPath' => 'name', 'code' => 'validation_failed'],
            self::pairs($body['violations']),
        );
    }

    /**
     * Every bad field at once. A form that reports one per submit makes somebody
     * guess how many more there are.
     */
    #[Test]
    public function everyViolationComesBackTogether(): void
    {
        $body = $this->register('nope', '', 'abc');

        self::assertSame(
            [
                ['propertyPath' => 'email', 'code' => 'validation_failed'],
                ['propertyPath' => 'name', 'code' => 'validation_failed'],
                ['propertyPath' => 'password', 'code' => 'password_too_short'],
            ],
            self::pairs($body['violations']),
        );
    }

    #[Test]
    public function aBodyThatIsNotJsonIsFourHundredRatherThanFourTwentyTwo(): void
    {
        $this->client->request('POST', '/api/auth/register', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: 'not json');

        self::assertSame(400, $this->client->getResponse()->getStatusCode());
    }

    #[Test]
    public function aMissingFieldIsFourTwentyTwo(): void
    {
        $this->client->request('POST', '/api/auth/register', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['email' => 'x@example.com']));

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
    }

    /**
     * The invitation path, which has no endpoint yet: sc-67 builds the record
     * that reaches it. The behaviour belongs to registration, so it is asserted
     * here against the service rather than left until that story.
     */
    #[Test]
    public function registrationThroughAnInvitationArrivesVerified(): void
    {
        $result = self::service(UserRegistrar::class)
            ->registerFromInvitation('invited@example.com', 'Invited', self::GOOD_PASSWORD);

        self::em()->flush();

        self::assertTrue(
            $result->user->getPrimaryEmailAddress()?->isVerified() ?? false,
            'the token proved control of the inbox',
        );
        self::assertSame([], $result->user->getPhoneNumbers(), 'and nothing was sent to a phone');
        self::assertTrue(
            $result->user->isVerified(),
            'so the person is through the verification gate without a code',
        );
    }

    #[Test]
    public function anOrdinaryRegistrationIsNotVerified(): void
    {
        $result = self::service(UserRegistrar::class)
            ->register('ordinary@example.com', 'Ordinary', self::GOOD_PASSWORD);

        self::em()->flush();

        self::assertFalse($result->user->getPrimaryEmailAddress()?->isVerified() ?? true);
        self::assertFalse($result->user->isVerified());
    }

    /**
     * The budget is per IP, because there is no account yet. Asserted at the
     * factory, which is the only level it can be asserted at: the limiter is
     * backed by an array cache in test — config/packages/cache.yaml explains
     * why — and `framework.test` resets it after every request, so it cannot
     * be exhausted over HTTP. AssistantTest does the same for the same reason.
     */
    #[Test]
    public function theConfiguredBudgetRunsOut(): void
    {
        $limiter = self::serviceById('limiter.registration', RateLimiterFactoryInterface::class)
            ->create('a-single-network');

        $accepted = 0;
        while ($limiter->consume()->isAccepted() && $accepted < 100) {
            ++$accepted;
        }

        self::assertGreaterThan(0, $accepted, 'the budget refused the first attempt');
        self::assertLessThan(100, $accepted, 'a budget that cannot be exhausted is not a budget');
    }

    /**
     * And that the endpoint actually consults it. Wired by hand rather than
     * over HTTP, for the reason above — this is the half that would otherwise
     * go unasserted, and a controller that forgot to call the limiter would
     * pass every other test in this file.
     */
    #[Test]
    public function theEndpointRefusesWhenTheBudgetIsGone(): void
    {
        $controller = new RegisterController(
            self::service(AccountSerialiser::class),
            self::service(PendingRegistrations::class),
            new RefusingRateLimiterFactory(),
        );

        try {
            $controller->register(Request::create('/api/auth/register', 'POST', content: '{}'));
            self::fail('the endpoint accepted a request with no budget left');
        } catch (ApiException $e) {
            self::assertSame(ErrorCode::TooManyAttempts, $e->errorCode);
            self::assertSame(429, $e->errorCode->status());
            self::assertMatchesRegularExpression('/^Too many sign-ups from this network\. Try again at \d\d:\d\d\.$/', $e->getMessage());
            self::assertGreaterThan(0, (int) ($e->headers['Retry-After'] ?? 0));
        }
    }

    private function owner(string $address): void
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Owner', self::GOOD_PASSWORD)->user;
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        self::em()->flush();
    }

    /** @return array<string, mixed> */
    private function confirm(#[SensitiveParameter] string $handle, #[SensitiveParameter] string $code): array
    {
        $this->client->request('POST', '/api/auth/register/verify', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['registration' => $handle, 'code' => $code]));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function opening(#[SensitiveParameter] string $handle): array
    {
        $this->client->request('GET', '/api/auth/register/resend', ['registration' => $handle]);
        self::assertSame(200, $this->statusCode());

        return $this->last();
    }

    private function resend(#[SensitiveParameter] string $handle): void
    {
        $this->client->request('POST', '/api/auth/register/resend', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['registration' => $handle]));
    }

    private function codeSentTo(string $address): string
    {
        $mail = $this->lastMail();
        self::assertSame($address, $mail->getTo()[0]->getAddress());

        return Regex\first_match((string) $mail->getTextBody(), '/\b(\d{6})\b/')[1] ?? '';
    }

    private function lastMail(): Email
    {
        return Type\instance_of(Email::class)->coerce(Iter\last(self::getMailerMessages()));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    /** @param array<int, array<string, string>> $violations */
    private static function pairs(array $violations): array
    {
        $pairs = [];

        foreach ($violations as $violation) {
            $pairs[] = ['propertyPath' => $violation['propertyPath'], 'code' => $violation['code']];
        }

        return $pairs;
    }

    /** @return array<string, mixed> */
    private function register(string $email, string $name, #[SensitiveParameter] string $password): array
    {
        $this->client->request('POST', '/api/auth/register', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode([
            'email' => $email,
            'name' => $name,
            'password' => $password,
        ]));

        return Json\typed(
            (string) $this->client->getResponse()->getContent(),
            \Psl\Type\dict(\Psl\Type\string(), \Psl\Type\mixed()),
        );
    }
}
