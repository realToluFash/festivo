<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\TwoFactor\SecretBox;
use App\Entity\TwoFactorFactor;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Repository\UserRepository;
use App\Tests\ApiTestCase;
use App\Tests\Fixtures\OpenIdConnect\TestCodeRedeemer;
use App\Tests\Fixtures\OpenIdConnect\TestSigningKeys;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use SensitiveParameter;
use Symfony\Component\Clock\Clock;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** Sign in with Apple on Android: form_post to the API, an App Link with a one-time handle, then the session. */
final class AppleAppReturnTest extends ApiTestCase
{
    use ClockSensitiveTrait;

    private const string VERIFIER = 'the-app-verifier-of-forty-three-characters-or-more';

    private const string RETURN_URI = 'http://localhost:8080/api/auth/oauth/apple/return';

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime('2026-10-17 12:00:00');
    }

    #[Test]
    public function aStateTheAppStartedGoesBackToTheAppWithAHandleOnly(): void
    {
        $this->start('app-state');

        $this->client->request('POST', '/api/auth/oauth/apple/return', ['code' => 'apple-code', 'state' => 'app-state']);
        $location = (string) $this->client->getResponse()->headers->get('Location');

        self::assertSame(303, $this->client->getResponse()->getStatusCode());
        self::assertStringStartsWith('https://soirely.test/oauth/apple/app?handle=', $location);
        self::assertStringNotContainsString('apple-code', $location, 'the code never travels in the App Link');
    }

    #[Test]
    public function aStateTheAppNeverStartedIsTheWebs(): void
    {
        $this->client->request('POST', '/api/auth/oauth/apple/return', ['code' => 'apple-code', 'state' => 'web-state']);

        self::assertStringContainsString('/oauth/apple?code=apple-code&state=web-state', (string) $this->client->getResponse()->headers->get('Location'));
    }

    #[Test]
    public function theHandleSignsInOnceWithTheNameAppleSentTheFirstTime(): void
    {
        $handle = $this->returned('app-state', '{"name":{"firstName":"Ada","lastName":"Lovelace"}}');

        $body = $this->exchange($handle, self::VERIFIER);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertIsString($body['accessToken'] ?? null);
        self::assertSame('Ada Lovelace', Type\shape(['name' => Type\string()], true)->coerce($body['account'])['name']);

        $this->exchange($handle, self::VERIFIER);
        self::assertSame(ErrorCode::OAuthTokenInvalid->type(), $this->last()['type'], 'a handle works once');
    }

    #[Test]
    public function aHandleRunsOutAfterAMinute(): void
    {
        $handle = $this->returned('app-state');
        self::mockTime('+61 seconds');

        $this->exchange($handle, self::VERIFIER);

        self::assertSame(401, $this->statusCode());
        self::assertSame(ErrorCode::OAuthTokenInvalid->type(), $this->last()['type']);
    }

    /** PKCE binds the handle to the device that started the attempt. */
    #[Test]
    public function aHandleIsRefusedWithAnotherAttemptsVerifier(): void
    {
        $handle = $this->returned('app-state');

        $this->exchange($handle, 'some-other-device-verifier-that-is-long-enough-too');

        self::assertSame(ErrorCode::OAuthTokenInvalid->type(), $this->last()['type']);
        self::assertSame([], self::service(TestCodeRedeemer::class)->redeemed, "Apple's code was never redeemed");
    }

    /** Two-factor gates this way in as it gates the others: a challenge, not tokens. */
    #[Test]
    public function anAccountWithTwoFactorGetsAChallengeInstead(): void
    {
        $handle = $this->returned('app-state');
        $this->exchange($handle, self::VERIFIER);
        $user = Type\instance_of(User::class)->coerce(self::service(UserRepository::class)->findOneByPrimaryEmailAddress('android-person@example.com'));

        $factor = new TwoFactorFactor($user, self::service(SecretBox::class)->seal('JBSWY3DPEHPK3PXP'));
        $factor->activate(new Clock()->now());
        self::service(EntityManagerInterface::class)->persist($factor);
        self::service(EntityManagerInterface::class)->flush();

        $body = $this->exchange($this->returned('second-state'), self::VERIFIER);

        self::assertSame(202, $this->statusCode(), Json\encode($body));
        self::assertIsString($body['twoFactorChallenge'] ?? null);
        self::assertArrayNotHasKey('accessToken', $body);
    }

    #[Test]
    public function cancellingAtAppleReturnsToTheAppWithNothingToExchange(): void
    {
        $this->start('app-state');

        $this->client->request('POST', '/api/auth/oauth/apple/return', ['state' => 'app-state', 'error' => 'user_cancelled_authorize']);

        self::assertSame('https://soirely.test/oauth/apple/app?error=cancelled', $this->client->getResponse()->headers->get('Location'));
    }

    private function start(string $state): void
    {
        $this->client->request('POST', '/api/auth/oauth/apple/attempts', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode([
            'state' => $state,
            'codeChallenge' => Str\trim_right(Str\replace_every(\base64_encode(\hash('sha256', self::VERIFIER, true)), ['+' => '-', '/' => '_']), '='),
        ]));
        self::assertSame(204, $this->statusCode());
    }

    private function returned(string $state, ?string $appleUser = null): string
    {
        $this->start($state);
        self::service(TestCodeRedeemer::class)->issue('apple-code', self::VERIFIER, $this->token());

        $this->client->request('POST', '/api/auth/oauth/apple/return', ['code' => 'apple-code', 'state' => $state, ...(null === $appleUser ? [] : ['user' => $appleUser])]);

        return Regex\first_match((string) $this->client->getResponse()->headers->get('Location'), '/handle=([0-9a-f]+)/')[1] ?? '';
    }

    /** @return array<string, mixed> */
    private function exchange(#[SensitiveParameter] string $handle, #[SensitiveParameter] string $verifier): array
    {
        $this->client->request('POST', '/api/auth/oauth/apple/handle', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode([
            'handle' => $handle,
            'codeVerifier' => $verifier,
            'redirectUri' => self::RETURN_URI,
        ]));

        return $this->last();
    }

    private function token(): string
    {
        $first = static fn (string $name): string => Str\trim(Str\split(Type\string()->coerce($_ENV[$name] ?? $_SERVER[$name] ?? ''), ',')[0] ?? '');

        return self::service(TestSigningKeys::class)->sign([
            'iss' => $first('OAUTH_APPLE_ISSUERS'),
            'aud' => $first('OAUTH_APPLE_CLIENT_IDS'),
            'iat' => new Clock()->now()->modify('-1 minute'),
            'exp' => new Clock()->now()->modify('+1 hour'),
            'sub' => 'a-android',
            'email' => 'android-person@example.com',
            'email_verified' => true,
        ]);
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
