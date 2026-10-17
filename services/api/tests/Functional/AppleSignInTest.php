<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Enum\ErrorCode;
use App\Repository\UserRepository;
use App\Tests\ApiTestCase;
use App\Tests\Fixtures\OpenIdConnect\TestCodeRedeemer;
use App\Tests\Fixtures\OpenIdConnect\TestSigningKeys;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use SensitiveParameter;

final class AppleSignInTest extends ApiTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
    }

    /** Apple sends the name only once, so the first authorisation is the only chance to keep it. */
    #[Test]
    public function theNameFromTheFirstAuthorisationIsKept(): void
    {
        $body = $this->signIn($this->token(['sub' => 'a-first']), name: 'Ada Lovelace');

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame('Ada Lovelace', $this->account($body)['name']);
        self::assertSame(['apple'], $this->account($body)['providers']);
    }

    #[Test]
    public function aLaterSignInWithNoNameLeavesTheStoredNameAlone(): void
    {
        $first = $this->signIn($this->token(['sub' => 'a-later']), name: 'Ada Lovelace');
        $later = $this->signIn($this->token(['sub' => 'a-later']));

        self::assertSame($this->account($first)['id'], $this->account($later)['id']);
        self::assertSame('Ada Lovelace', $this->account($later)['name']);
    }

    #[Test]
    public function aNameNeverOverwritesOneAlreadyStored(): void
    {
        $this->signIn($this->token(['sub' => 'a-kept']), name: 'Ada Lovelace');
        $again = $this->signIn($this->token(['sub' => 'a-kept']), name: 'Somebody Else');

        self::assertSame('Ada Lovelace', $this->account($again)['name']);
    }

    /** Revoking the app in Apple's settings keeps the same `sub`, so signing in again is the same account. */
    #[Test]
    public function signingInAgainAfterRevokingIsTheSameAccountNotADuplicate(): void
    {
        $this->signIn($this->token(['sub' => 'a-revoked']), name: 'Ada Lovelace');
        $this->signIn($this->token(['sub' => 'a-revoked']));

        self::assertSame(1, self::service(UserRepository::class)->count([]));
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function aPrivateRelayAddressWorksLikeAnyOther(): void
    {
        $body = $this->signIn($this->token([
            'sub' => 'a-relay',
            'email' => 'x7k2p9@privaterelay.appleid.com',
            'email_verified' => 'true',
            'is_private_email' => 'true',
        ]));

        $address = Type\shape(['address' => Type\string(), 'verified' => Type\bool()], true)->coerce($this->account($body)['emailAddresses'][0] ?? null);
        self::assertSame('x7k2p9@privaterelay.appleid.com', $address['address']);
        self::assertTrue($address['verified']);
    }

    #[Test]
    public function aVerifiedAddressLinksToItsOwnerAndSaysSo(): void
    {
        $owner = self::service(UserRegistrar::class)->register('owner@example.com', 'Owner', self::PASSWORD)->user;
        $owner->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        self::service(EntityManagerInterface::class)->flush();
        $ownerId = $owner->getId()->toRfc4122();
        self::service(EntityManagerInterface::class)->clear();

        $body = $this->signIn($this->token(['sub' => 'a-owner', 'email' => 'owner@example.com']));

        self::assertTrue($body['linked']);
        self::assertSame($ownerId, $this->account($body)['id']);
    }

    #[Test]
    public function aCapturedTokenIsUselessWithoutItsNonce(): void
    {
        $this->signIn($this->token(['sub' => 'a-nonce', 'nonce' => \hash('sha256', 'raw')]), nonce: 'not it');

        self::assertSame(401, $this->statusCode());
        self::assertSame(ErrorCode::OAuthTokenInvalid->type(), $this->last()['type']);
    }

    #[Test]
    public function theWebsCodeIsRedeemedByTheApiWithTheNameApplePosted(): void
    {
        self::service(TestCodeRedeemer::class)->issue('apple-code', 'verifier', $this->token(['sub' => 'a-web']));

        $this->client->request('POST', '/api/auth/oauth/apple', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode([
            'code' => 'apple-code',
            'codeVerifier' => 'verifier',
            'redirectUri' => 'http://localhost:8080/api/auth/oauth/apple/return',
            'name' => 'Ada Lovelace',
        ]));

        self::assertSame(200, $this->statusCode());
        self::assertSame('Ada Lovelace', $this->account($this->last())['name']);
    }

    /** Apple's form_post goes on to our own web origin only, carrying what Apple sent. */
    #[Test]
    public function applesFormPostIsSentOnToTheWebsCallback(): void
    {
        $this->client->request('POST', '/api/auth/oauth/apple/return', [
            'code' => 'c1',
            'state' => 's1',
            'user' => '{"name":{"firstName":"Ada","lastName":"Lovelace"}}',
            'redirect' => 'https://evil.test',
        ]);

        $response = $this->client->getResponse();
        self::assertSame(303, $response->getStatusCode());
        $location = (string) $response->headers->get('Location');
        self::assertStringStartsWith(self::configured('CORS_WEB_ORIGIN') . '/oauth/apple?', $location);
        self::assertStringContainsString('code=c1', $location);
        self::assertStringContainsString('state=s1', $location);
        self::assertStringContainsString('user=', $location);
        self::assertStringNotContainsString('evil', $location);
    }

    #[Test]
    public function aProviderWeDoNotKnowIsNotARoute(): void
    {
        $this->client->request('POST', '/api/auth/oauth/myspace', server: ['CONTENT_TYPE' => 'application/json'], content: '{}');

        self::assertSame(404, $this->statusCode());
    }

    /** @param array<string, mixed> $overrides */
    private function token(array $overrides): string
    {
        return self::service(TestSigningKeys::class)->sign([
            'iss' => self::first('OAUTH_APPLE_ISSUERS'),
            'aud' => self::first('OAUTH_APPLE_CLIENT_IDS'),
            'iat' => new DateTimeImmutable('-1 minute'),
            'exp' => new DateTimeImmutable('+1 hour'),
            'email' => 'apple-person@example.com',
            'email_verified' => true,
            ...$overrides,
        ]);
    }

    private static function configured(string $name): string
    {
        return Type\string()->coerce($_ENV[$name] ?? $_SERVER[$name] ?? '');
    }

    /** The first of a configured list, read in the order Symfony reads it. */
    private static function first(string $name): string
    {
        return Str\trim(Str\split(self::configured($name), ',')[0] ?? '');
    }

    /** @return array<string, mixed> */
    private function signIn(#[SensitiveParameter] string $idToken, #[SensitiveParameter] ?string $nonce = null, ?string $name = null): array
    {
        $this->client->request('POST', '/api/auth/oauth/apple', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode([
            'idToken' => $idToken,
            'nonce' => $nonce,
            'name' => $name,
        ]));

        return $this->last();
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    private function account(array $body): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce($body['account'] ?? null);
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
