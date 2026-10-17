<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\RevokedSessions;
use App\Domain\User\TokenIssuer;
use App\Domain\User\UserRegistrar;
use App\Entity\RefreshToken;
use App\Entity\User;
use App\Enum\IdentityProvider;
use App\Repository\RefreshTokenRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\RecordingLogger;
use App\Tests\Traits\OnboardsAccounts;
use Lexik\Bundle\JWTAuthenticationBundle\Encoder\JWTEncoderInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Regex;
use Psl\Type;
use Psr\Log\LogLevel;
use Redis;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

final class RevokedSessionTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function aDeviceEndedFromTheListIsRefusedOnItsNextRequest(): void
    {
        $this->account('listed@example.com');
        $laptop = $this->signIn('listed@example.com');
        $phone = $this->signIn('listed@example.com');

        $this->client->request('DELETE', '/api/auth/sessions/' . $phone['sessionId'], server: [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $laptop['accessToken'],
        ]);
        self::assertSame(204, $this->client->getResponse()->getStatusCode());

        self::assertSame(401, $this->me($phone['accessToken']));
    }

    #[Test]
    public function aSessionNeverRevokedIsUnaffected(): void
    {
        $this->account('untouched@example.com');
        $laptop = $this->signIn('untouched@example.com');
        $phone = $this->signIn('untouched@example.com');

        $this->client->request('DELETE', '/api/auth/sessions/' . $phone['sessionId'], server: [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $laptop['accessToken'],
        ]);

        self::assertSame(200, $this->me($laptop['accessToken']));
    }

    #[Test]
    public function signingOutEndsTheAccessTokenItWasHolding(): void
    {
        $this->account('self@example.com');
        $phone = $this->signIn('self@example.com');

        $this->client->request('POST', '/api/auth/logout', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode([
            'refreshToken' => $phone['refreshToken'],
        ]));
        self::assertSame(204, $this->client->getResponse()->getStatusCode());

        self::assertSame(401, $this->me($phone['accessToken']));
    }

    #[Test]
    public function aReplayedRefreshTokenEndsEveryAccessTokenOfItsChain(): void
    {
        $this->account('replayed@example.com');
        $first = $this->signIn('replayed@example.com');
        $second = $this->refresh($first['refreshToken']);

        $this->refresh($first['refreshToken']);
        self::assertSame(401, $this->client->getResponse()->getStatusCode());

        self::assertSame(401, $this->me($second['accessToken']), 'the newest access token, which the replay did not present');
    }

    /** The shared path of sign out everywhere else (sc-115) and a password change (sc-116). */
    #[Test]
    public function everySessionButTheOneKeptIsRefused(): void
    {
        $user = $this->account('except@example.com');
        $laptop = $this->signIn('except@example.com');
        $phone = $this->signIn('except@example.com');
        $tablet = $this->signIn('except@example.com');

        $ended = self::service(TokenIssuer::class)->revokeAllExcept($user, Uuid::fromString(Type\string()->coerce($laptop['sessionId'])));

        self::assertSame(3, $ended, "registering's own session, the phone's and the tablet's");
        self::assertSame(401, $this->me($phone['accessToken']));
        self::assertSame(401, $this->me($tablet['accessToken']));
        self::assertSame(200, $this->me($laptop['accessToken']));
    }

    /** The path of a password reset and of a two-factor recovery. */
    #[Test]
    public function everySessionOfTheAccountIsRefused(): void
    {
        $user = $this->account('all@example.com');
        $laptop = $this->signIn('all@example.com');
        $phone = $this->signIn('all@example.com');

        self::service(TokenIssuer::class)->revokeAllFor($user);

        self::assertSame(401, $this->me($laptop['accessToken']));
        self::assertSame(401, $this->me($phone['accessToken']));
    }

    /** Unlinking a provider signs out the sessions it started (sc-510). */
    #[Test]
    public function aSessionStartedThroughAnUnlinkedProviderIsRefused(): void
    {
        $user = $this->account('unlinked@example.com');
        $google = self::service(TokenIssuer::class)->issueFor($user, null, IdentityProvider::Google);
        self::em()->flush();
        $laptop = $this->signIn('unlinked@example.com');

        self::assertSame(1, self::service(TokenIssuer::class)->revokeSignedInWith($user, IdentityProvider::Google));

        self::assertSame(401, $this->me($google->accessToken));
        self::assertSame(200, $this->me($laptop['accessToken']));
    }

    #[Test]
    public function theRefusalIsAnExpiredTokensWordForWord(): void
    {
        $this->account('alike@example.com');
        $phone = $this->signIn('alike@example.com');
        $this->client->request('POST', '/api/auth/logout', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode([
            'refreshToken' => $phone['refreshToken'],
        ]));

        $revoked = $this->refusal($phone['accessToken']);
        $expired = $this->refusal(self::service(JWTEncoderInterface::class)->encode([
            'username' => $this->find($phone['refreshToken'])?->getUser()->getUserIdentifier(),
            'iat' => \time() - 3600,
            'exp' => \time() - 60,
        ]));

        self::assertSame($expired, $revoked);
    }

    #[Test]
    public function anEntryLastsAsLongAsAnAccessTokenAndNoLonger(): void
    {
        $user = $this->account('lifetime@example.com');
        $phone = $this->signIn('lifetime@example.com');
        $chain = $this->find($phone['refreshToken'])?->getChainId();
        self::assertNotNull($chain);

        self::service(TokenIssuer::class)->revokeAllFor($user);

        $ttl = Type\int()->coerce(self::getContainer()->getParameter('lexik_jwt_authentication.token_ttl'));
        $left = Type\int()->coerce(self::service(Redis::class)->ttl('revoked_session:' . $chain->toRfc4122()));

        self::assertGreaterThan($ttl - 5, $left);
        self::assertLessThanOrEqual($ttl, $left);
    }

    #[Test]
    public function anUnreachableListRefusesNobodyAndSaysSo(): void
    {
        $logger = new RecordingLogger();
        $unreachable = new RevokedSessions(new Redis(), $logger, 900);
        $session = Uuid::v7();

        $unreachable->add($session);

        self::assertFalse($unreachable->includes($session));
        self::assertSame(
            [
                ['level' => LogLevel::CRITICAL, 'message' => RevokedSessions::UNREACHABLE],
                ['level' => LogLevel::CRITICAL, 'message' => RevokedSessions::UNREACHABLE],
            ],
            $logger->records,
            'both the write and the check are reported',
        );
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Revoked', self::PASSWORD)->user;
        self::onboard($user);

        return $user;
    }

    private function find(#[SensitiveParameter] string $plain): ?RefreshToken
    {
        return self::service(RefreshTokenRepository::class)->findOneByHash(TokenIssuer::hash($plain));
    }

    /** @return array{accessToken: string, refreshToken: string, sessionId: string} */
    private function signIn(string $address): array
    {
        $this->client->request('POST', '/api/auth/login', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['email' => $address, 'password' => self::PASSWORD]));

        return $this->tokens();
    }

    /** @return array{accessToken: string, refreshToken: string, sessionId: string} */
    private function refresh(#[SensitiveParameter] string $token): array
    {
        $this->client->request('POST', '/api/auth/refresh', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['refreshToken' => $token]));

        return 200 === $this->client->getResponse()->getStatusCode()
            ? $this->tokens()
            : ['accessToken' => '', 'refreshToken' => '', 'sessionId' => ''];
    }

    /** @return array{accessToken: string, refreshToken: string, sessionId: string} */
    private function tokens(): array
    {
        $body = Json\typed((string) $this->client->getResponse()->getContent(), Type\shape([
            'accessToken' => Type\string(),
            'refreshToken' => Type\string(),
            'sessionId' => Type\string(),
        ], true));

        return ['accessToken' => $body['accessToken'], 'refreshToken' => $body['refreshToken'], 'sessionId' => $body['sessionId']];
    }

    private function me(#[SensitiveParameter] string $accessToken): int
    {
        $this->client->request('GET', '/api/auth/me', server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $accessToken]);

        return $this->client->getResponse()->getStatusCode();
    }

    /** @return array{status: int, contentType: ?string, challenge: ?string, body: string} */
    private function refusal(#[SensitiveParameter] string $accessToken): array
    {
        $this->me($accessToken);
        $response = $this->client->getResponse();

        return [
            'status' => $response->getStatusCode(),
            'contentType' => $response->headers->get('Content-Type'),
            'challenge' => $response->headers->get('WWW-Authenticate'),
            'body' => Regex\replace((string) $response->getContent(), '/"correlationId":"[^"]*"/', ''),
        ];
    }
}
