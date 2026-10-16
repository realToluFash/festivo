<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Controller\RegisterController;
use App\Domain\User\Password\PasswordPolicy;
use App\Domain\User\Password\PasswordResolver;
use App\Domain\User\Password\ScriptedBreachedPasswordChecker;
use App\Domain\User\TokenIssuer;
use App\Domain\User\UserRegistrar;
use App\Entity\RefreshToken;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\UserRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\RefusingRateLimiterFactory;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

final class RegisterTest extends ApiTestCase
{
    /**
     * A literal password, which is the one thing a registration test cannot do
     * without. The rule is right everywhere else: a credential in source is a
     * credential in every clone of the repository.
     *
     * @mago-expect lint:no-literal-password
     */
    private const string GOOD_PASSWORD = 'a decent passphrase';

    #[Test]
    public function itCreatesAnAccountAndSignsThePersonIn(): void
    {
        $body = $this->register('New.Person@Example.COM  ', 'Ada Lovelace', self::GOOD_PASSWORD);

        self::assertSame(201, $this->client->getResponse()->getStatusCode());

        // Stored as the entity normalises it, and returned the same way, so the
        // client is not holding a different string from the database.
        // The same account sign-in answers with, so a client reads one shape.
        $account = Type\shape([
            'name' => Type\string(),
            'verified' => Type\bool(),
            'complete' => Type\bool(),
            'businessName' => Type\null(),
            'emailAddresses' => Type\vec(Type\shape(['address' => Type\string()], true)),
            'phoneNumbers' => Type\vec(Type\mixed()),
        ], true)->coerce($body['account']);

        self::assertSame('new.person@example.com', $account['emailAddresses'][0]['address']);
        self::assertSame('Ada Lovelace', $account['name']);

        self::assertFalse($account['verified'], 'an ordinary registration proves nothing yet');
        self::assertFalse($account['complete'], 'and carries no profile fields');
        self::assertSame([], $account['phoneNumbers']);

        self::assertNotSame('', $body['accessToken']);
        self::assertNotSame('', $body['refreshToken']);
        self::assertArrayHasKey('refreshExpiresAt', $body);
    }

    #[Test]
    public function theAccountIsReachableAfterwards(): void
    {
        $this->register('reachable@example.com', 'Reachable', self::GOOD_PASSWORD);

        $user = self::service(UserRepository::class)->findOneByPrimaryEmailAddress('REACHABLE@example.com');

        self::assertNotNull($user, 'findOneByEmail normalises what it is given');
        self::assertFalse($user->getPrimaryEmailAddress()?->isVerified() ?? true);
        self::assertNotNull($user->getPassword());
    }

    /**
     * The password is hashed, and the hash is not a hash of the raw value: it is
     * a hash of the normalised one. A sign-in path that normalises differently
     * is the failure this pins down, and sc-55 inherits it.
     */
    #[Test]
    public function thePasswordIsStoredHashedAndVerifiesThroughTheSameNormalisation(): void
    {
        $this->register('hashed@example.com', 'Hashed', self::GOOD_PASSWORD);

        $user = self::service(UserRepository::class)->findOneByPrimaryEmailAddress('hashed@example.com');
        self::assertNotNull($user);

        $stored = $user->getPassword();
        self::assertNotNull($stored);
        self::assertNotSame(self::GOOD_PASSWORD, $stored, 'the plain value is not the stored value');
        self::assertStringStartsWith('$argon2id$', $stored, 'sodium, not bcrypt — see security.yaml');

        $passwords = self::service(PasswordResolver::class);
        self::assertTrue($passwords->verify($user, self::GOOD_PASSWORD));
        self::assertFalse($passwords->verify($user, self::GOOD_PASSWORD . 'x'));
    }

    #[Test]
    public function theRefreshTokenIsStoredAsAHashAndNotAsItself(): void
    {
        $body = $this->register('session@example.com', 'Session', self::GOOD_PASSWORD);
        $plain = $body['refreshToken'];

        $rows = self::em()->getRepository(RefreshToken::class)->findAll();
        self::assertCount(1, $rows);

        // The plain token must appear nowhere in the table. A dump of this
        // database is then not a set of working sessions.
        $stored = self::em()->getConnection()
            ->executeQuery('SELECT token_hash FROM refresh_tokens')
            ->fetchFirstColumn();

        self::assertNotContains($plain, $stored);
        self::assertContains(TokenIssuer::hash($plain), $stored);
    }

    #[Test]
    public function thePasswordIsNowhereInTheResponse(): void
    {
        $this->register('quiet@example.com', 'Quiet', self::GOOD_PASSWORD);

        $raw = (string) $this->client->getResponse()->getContent();

        self::assertStringNotContainsString(self::GOOD_PASSWORD, $raw);
        self::assertStringNotContainsString('password', $raw, 'not even the field name comes back');
    }

    #[Test]
    public function aSecondRegistrationWithTheSameAddressIsRefused(): void
    {
        $this->register('taken@example.com', 'First', self::GOOD_PASSWORD);
        $body = $this->register('taken@example.com', 'Second', self::GOOD_PASSWORD);

        self::assertSame(409, $this->client->getResponse()->getStatusCode());
        self::assertSame(ErrorCode::EmailTaken->type(), $body['type']);
    }

    /**
     * The same address written differently is the same address. Without
     * normalisation on the lookup this registers twice and the second account
     * can never sign in, because the provider finds the first.
     */
    #[Test]
    public function theDuplicateCheckNormalisesTheAddress(): void
    {
        $this->register('normalise@example.com', 'First', self::GOOD_PASSWORD);
        $body = $this->register('  NORMALISE@Example.com ', 'Second', self::GOOD_PASSWORD);

        self::assertSame(409, $this->client->getResponse()->getStatusCode());
        self::assertSame(ErrorCode::EmailTaken->type(), $body['type']);
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
            self::service(UserRegistrar::class),
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
