<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Entity\ProviderIdentity;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Repository\ProviderIdentityRepository;
use App\Repository\UserRepository;
use App\Tests\ApiTestCase;
use App\Tests\Fixtures\OpenIdConnect\TestSigningKeys;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use SensitiveParameter;

final class GoogleSignInTest extends ApiTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
    }

    #[Test]
    public function aNewPersonGetsAnAccountWithTheAddressAlreadyVerified(): void
    {
        $body = $this->signIn($this->token(['sub' => 'g-new', 'email' => 'New.Person@Example.com', 'name' => 'New Person']));

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertFalse($body['linked']);
        self::assertIsString($body['accessToken'] ?? null, 'the same answer as password sign-in');

        $account = Type\shape([
            'name' => Type\string(),
            'verified' => Type\bool(),
            'complete' => Type\bool(),
            'emailAddresses' => Type\vec(Type\shape(['address' => Type\string(), 'verified' => Type\bool()], true)),
            'phoneNumbers' => Type\vec(Type\mixed()),
            'providers' => Type\vec(Type\string()),
        ], true)->coerce($body['account']);

        self::assertSame('New Person', $account['name']);
        self::assertSame('new.person@example.com', $account['emailAddresses'][0]['address']);
        self::assertTrue($account['emailAddresses'][0]['verified']);
        self::assertTrue($account['verified'], 'no phone, so the email is enough');
        self::assertFalse($account['complete'], 'it lands on the details screen');
        self::assertSame([], $account['phoneNumbers']);
        self::assertSame(['google'], $account['providers'], 'the details screen says Google confirmed the address');
        self::assertCount(0, self::getMailerMessages(), 'no verification email');
    }

    #[Test]
    public function anIdentitySeenBeforeSignsIntoTheSameAccount(): void
    {
        $first = $this->signIn($this->token(['sub' => 'g-again', 'email' => 'again@example.com']));
        $second = $this->signIn($this->token(['sub' => 'g-again', 'email' => 'again@example.com']));

        self::assertSame($this->accountId($first), $this->accountId($second));
        self::assertSame(1, self::service(UserRepository::class)->count([]));
    }

    #[Test]
    public function aVerifiedAddressLinksToTheAccountThatOwnsItAndSaysSoOnce(): void
    {
        $owner = $this->registered('owner@example.com', verified: true);

        $first = $this->signIn($this->token(['sub' => 'g-owner', 'email' => 'owner@example.com']));
        $second = $this->signIn($this->token(['sub' => 'g-owner', 'email' => 'owner@example.com']));

        self::assertSame($owner->getId()->toRfc4122(), $this->accountId($first));
        self::assertTrue($first['linked']);
        self::assertFalse($second['linked'], 'told once');
        self::assertSame(1, self::service(UserRepository::class)->count([]), 'no second account');
    }

    #[Test]
    public function anAddressTheProviderDidNotVerifyNeverLinks(): void
    {
        $this->registered('owner@example.com', verified: true);

        $this->signIn($this->token(['sub' => 'g-unverified', 'email' => 'owner@example.com', 'email_verified' => false]));

        $this->assertRefused();
        self::assertSame(0, self::service(ProviderIdentityRepository::class)->count([]));
    }

    /** Linking to an address nobody proved would keep the password of whoever typed it there. */
    #[Test]
    public function anAccountThatNeverVerifiedTheAddressIsReleasedNotLinked(): void
    {
        $squatter = $this->registered('owner@example.com', verified: false);
        $squatterId = $squatter->getId();

        $body = $this->signIn($this->token(['sub' => 'g-real-owner', 'email' => 'owner@example.com']));

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertFalse($body['linked']);
        self::assertNotSame($squatterId->toRfc4122(), $this->accountId($body));
        self::service(EntityManagerInterface::class)->clear();
        self::assertNull(self::service(UserRepository::class)->find($squatterId));
    }

    #[Test]
    public function aTamperedSignatureIsRefused(): void
    {
        $this->signIn($this->keys()->sign($this->claims(['sub' => 'g-tampered']), TestSigningKeys::generate()));

        $this->assertRefused();
    }

    #[Test]
    public function aTokenForAnotherAudienceIsRefused(): void
    {
        $this->signIn($this->token(['sub' => 'g-aud', 'aud' => 'somebody-elses-app']));

        $this->assertRefused();
    }

    #[Test]
    public function aTokenFromAnotherIssuerIsRefused(): void
    {
        $this->signIn($this->token(['sub' => 'g-iss', 'iss' => 'https://evil.test']));

        $this->assertRefused();
    }

    #[Test]
    public function anExpiredTokenIsRefused(): void
    {
        $this->signIn($this->token([
            'sub' => 'g-expired',
            'iat' => new DateTimeImmutable('-2 hours'),
            'exp' => new DateTimeImmutable('-1 hour'),
        ]));

        $this->assertRefused();
    }

    #[Test]
    public function aCapturedTokenIsUselessWithoutItsNonce(): void
    {
        $token = $this->token(['sub' => 'g-nonce', 'nonce' => \hash('sha256', 'the raw nonce')]);

        $this->signIn($token, 'a different nonce');
        $this->assertRefused();

        $this->signIn($token, null);
        $this->assertRefused();

        $this->signIn($token, 'the raw nonce');
        self::assertSame(200, $this->statusCode());
    }

    /** The sandbox's trap: it rotates its key under the same id, so a cached key goes stale. */
    #[Test]
    public function aKeyRotatedUnderTheSameIdIsFetchedAgainOnce(): void
    {
        $this->signIn($this->token(['sub' => 'g-rotate']));
        $fetches = $this->keys()->fetches;

        $this->keys()->rotate();
        $this->signIn($this->token(['sub' => 'g-rotate']));

        self::assertSame(200, $this->statusCode());
        self::assertSame($fetches + 1, $this->keys()->fetches);
    }

    #[Test]
    public function somethingThatIsNotATokenIsRefused(): void
    {
        $this->signIn('not.a.token');

        $this->assertRefused();
    }

    /** @param array<string, mixed> $overrides */
    private function token(array $overrides): string
    {
        return $this->keys()->sign($this->claims($overrides));
    }

    /**
     * @param array<string, mixed> $overrides
     *
     * @return array<string, mixed>
     */
    private function claims(array $overrides): array
    {
        return [
            'iss' => self::configured('OAUTH_GOOGLE_ISSUERS'),
            'aud' => self::configured('OAUTH_GOOGLE_CLIENT_IDS'),
            'iat' => new DateTimeImmutable('-1 minute'),
            'exp' => new DateTimeImmutable('+1 hour'),
            'email' => 'someone@example.com',
            'email_verified' => true,
            ...$overrides,
        ];
    }

    /** The first of a configured list: the container's environment wins over .env.test, so read what is set. */
    private static function configured(string $name): string
    {
        $value = Type\string()->coerce($_SERVER[$name] ?? $_ENV[$name] ?? '');

        return Str\trim(Str\split($value, ',')[0] ?? '');
    }

    private function keys(): TestSigningKeys
    {
        return self::service(TestSigningKeys::class);
    }

    private function registered(string $address, bool $verified): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        $user->getPrimaryEmailAddress()?->setVerifiedAt($verified ? new DateTimeImmutable() : null);
        self::service(EntityManagerInterface::class)->flush();
        // As a separate request would: nothing from the registration is still held in memory.
        self::service(EntityManagerInterface::class)->clear();

        return $user;
    }

    /** @return array<string, mixed> */
    private function signIn(#[SensitiveParameter] string $idToken, #[SensitiveParameter] ?string $nonce = null): array
    {
        $this->client->request('POST', '/api/auth/oauth/google', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode([
            'idToken' => $idToken,
            'nonce' => $nonce,
        ]));

        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    /** @param array<string, mixed> $body */
    private function accountId(array $body): string
    {
        return Type\shape(['id' => Type\string()], true)->coerce($body['account'])['id'];
    }

    private function assertRefused(): void
    {
        self::assertSame(401, $this->statusCode());
        self::assertSame(
            ErrorCode::OAuthTokenInvalid->type(),
            Type\shape(['type' => Type\string()], true)->coerce(Json\decode((string) $this->client->getResponse()->getContent()))['type'],
        );
        self::assertSame(0, self::service(EntityManagerInterface::class)->getRepository(ProviderIdentity::class)->count(['provider' => IdentityProvider::Google, 'subject' => 'g-tampered']));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
