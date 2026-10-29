<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\TokenIssuer;
use App\Domain\User\UserRegistrar;
use App\Entity\RefreshToken;
use App\Enum\ErrorCode;
use App\Repository\RefreshTokenRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\RecordingLogger;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\DriverManager;
use Doctrine\DBAL\Exception\DriverException;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Regex;
use Psl\SecureRandom;
use Psl\Vec;
use Psr\Log\LogLevel;
use SensitiveParameter;

final class SessionTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function refreshingReturnsANewPairAndRetiresTheOldOne(): void
    {
        ['refreshToken' => $first] = $this->signIn('rotate@example.com');

        $second = $this->refresh($first);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertNotSame($first, $second['refreshToken'], 'the token rotated');
        self::assertNotSame('', $second['accessToken']);

        self::assertNotNull(
            $this->find($first)?->getRevokedAt(),
            'the token just exchanged is revoked, so it cannot be used twice',
        );
    }

    #[Test]
    public function theNewTokenStaysInTheSameChain(): void
    {
        ['refreshToken' => $first] = $this->signIn('chain@example.com');
        $second = $this->refresh($first);

        self::assertEquals(
            $this->find($first)?->getChainId(),
            $this->find($second['refreshToken'])?->getChainId(),
            'rotation continues the chain rather than starting one',
        );
    }

    #[Test]
    public function replayingAUsedTokenRevokesTheWholeChain(): void
    {
        ['refreshToken' => $first] = $this->signIn('replay@example.com');
        $second = $this->refresh($first);
        $third = $this->refresh($second['refreshToken']);

        $body = $this->refresh($first);

        self::assertSame(401, $this->client->getResponse()->getStatusCode());
        self::assertSame(ErrorCode::InvalidRefreshToken->type(), $body['type']);

        self::em()->clear();

        foreach ([$first, $second['refreshToken'], $third['refreshToken']] as $token) {
            self::assertNotNull(
                $this->find($token)?->getRevokedAt(),
                'every token in the chain is revoked, including the newest',
            );
        }

        $this->refresh($third['refreshToken']);
        self::assertSame(401, $this->client->getResponse()->getStatusCode());
    }

    #[Test]
    public function aReplayDoesNotTouchAnotherSessionOnTheSameAccount(): void
    {
        $this->account('two-devices@example.com');

        ['refreshToken' => $phone] = $this->signInExisting('two-devices@example.com');
        ['refreshToken' => $laptop] = $this->signInExisting('two-devices@example.com');

        $phoneSecond = $this->refresh($phone);
        $this->refresh($phone);
        self::assertSame(401, $this->client->getResponse()->getStatusCode(), 'the replay was refused');

        self::em()->clear();

        self::assertNotNull($this->find($phoneSecond['refreshToken'])?->getRevokedAt());
        self::assertNull(
            $this->find($laptop)?->getRevokedAt(),
            'a theft on one device does not sign the other one out',
        );
    }

    #[Test]
    public function twoClientsDoNotInvalidateEachOther(): void
    {
        $this->account('parallel@example.com');

        ['refreshToken' => $first] = $this->signInExisting('parallel@example.com');
        ['refreshToken' => $second] = $this->signInExisting('parallel@example.com');

        $this->refresh($first);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());

        $this->refresh($second);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
    }

    #[Test]
    public function anUnknownTokenAnswersExactlyAsAnExpiredOneDoes(): void
    {
        ['refreshToken' => $token] = $this->signIn('unknown@example.com');

        $expired = $this->find($token);
        self::assertNotNull($expired);
        $expired->setRevokedAt(new DateTimeImmutable('-1 day'));
        self::em()->flush();

        $revoked = $this->rawRefresh($token);
        $unknown = $this->rawRefresh(\bin2hex(SecureRandom\bytes(32)));

        self::assertSame(401, $revoked['status']);
        self::assertSame($unknown['body'], $revoked['body']);
    }

    #[Test]
    public function signingOutRevokesTheTokenItPresents(): void
    {
        ['refreshToken' => $first] = $this->signIn('signout@example.com');
        $second = $this->refresh($first);

        $this->client->request('POST', '/api/auth/logout', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['refreshToken' => $second['refreshToken']]));

        self::assertSame(204, $this->client->getResponse()->getStatusCode());

        self::em()->clear();
        self::assertNotNull($this->find($second['refreshToken'])?->getRevokedAt());

        $this->refresh($second['refreshToken']);
        self::assertSame(401, $this->client->getResponse()->getStatusCode());
    }

    #[Test]
    public function signingOutWithATokenARefreshRotatedAwayEndsTheSession(): void
    {
        ['refreshToken' => $first] = $this->signIn('rotated@example.com');
        $second = $this->refresh($first);

        $this->client->request('POST', '/api/auth/logout', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['refreshToken' => $first]));

        self::assertSame(204, $this->client->getResponse()->getStatusCode());

        self::em()->clear();
        self::assertNotNull($this->find($second['refreshToken'])?->getRevokedAt());
    }

    #[Test]
    public function aRefreshHoldingTheChainSeesTheSignOutThatEndedItUnderIt(): void
    {
        ['refreshToken' => $token] = $this->signIn('raced@example.com');
        $loaded = $this->find($token);
        self::assertNotNull($loaded);
        $issuer = self::service(TokenIssuer::class);

        $issuer->revokeChain($loaded);
        self::assertNull($loaded->getRevokedAt(), 'the refresh read its token before the sign-out landed');

        $issuer->holdChain($loaded);

        self::assertNotNull($loaded->getRevokedAt());
    }

    #[Test]
    public function aRefreshWaitsForTheChainItRotates(): void
    {
        self::assertSame('55P03', $this->whileTheChainIsHeld($this->refresh(...)));
    }

    /** Otherwise a sign-out landing mid-refresh misses the token that refresh issues. */
    #[Test]
    public function aSignOutWaitsForTheChainItEnds(): void
    {
        self::assertSame('55P03', $this->whileTheChainIsHeld($this->signOut(...)));
    }

    #[Test]
    public function aRefreshThatLosesToASignOutIsNotReportedAsATheft(): void
    {
        $this->client->disableReboot();
        $logger = new RecordingLogger();
        self::getContainer()->set('logger', $logger);
        ['refreshToken' => $token] = $this->signIn('lost-race@example.com');

        $this->client->request('POST', '/api/auth/logout', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['refreshToken' => $token]));
        $this->refresh($token);

        self::assertSame(401, $this->client->getResponse()->getStatusCode());
        self::assertSame([], Vec\filter($logger->records, static fn (array $record): bool => LogLevel::WARNING === $record['level']));
    }

    #[Test]
    public function signingOutTwiceIsNotAnError(): void
    {
        ['refreshToken' => $token] = $this->signIn('twice@example.com');

        for ($attempt = 0; $attempt < 2; ++$attempt) {
            $this->client->request('POST', '/api/auth/logout', server: [
                'CONTENT_TYPE' => 'application/json',
            ], content: Json\encode(['refreshToken' => $token]));

            self::assertSame(204, $this->client->getResponse()->getStatusCode());
        }
    }

    #[Test]
    public function meAnswersWhileUnverifiedAndIncomplete(): void
    {
        self::service(UserRegistrar::class)->register('gate@example.com', 'Session', self::PASSWORD);
        self::em()->flush();
        ['accessToken' => $access] = $this->signInExisting('gate@example.com');

        $body = $this->get('/api/auth/me', $access);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertFalse($body['verified'], 'it is how a client finds out which gate it is behind');
        self::assertFalse($body['complete']);
        self::assertCount(1, $body['emailAddresses']);
        self::assertSame('gate@example.com', $body['emailAddresses'][0]['address']);
        self::assertTrue($body['emailAddresses'][0]['primary']);
        self::assertFalse($body['emailAddresses'][0]['verified']);
        self::assertSame([], $body['phoneNumbers']);
    }

    #[Test]
    public function meRefusesWithoutAToken(): void
    {
        $this->client->request('GET', '/api/auth/me');

        self::assertSame(401, $this->client->getResponse()->getStatusCode());
    }

    #[Test]
    public function sessionsListsThemAndEndingOneRevokesIt(): void
    {
        $this->account('sessions@example.com');

        $phone = $this->signInExisting('sessions@example.com');
        $laptop = $this->signInExisting('sessions@example.com');

        $body = $this->get('/api/auth/sessions', $laptop['accessToken']);
        self::assertCount(
            3,
            $body['sessions'],
            'three, because registering signs the person in and that is a session like any other',
        );

        $this->client->request('DELETE', '/api/auth/sessions/' . $phone['sessionId'], server: [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $laptop['accessToken'],
        ]);
        self::assertSame(204, $this->client->getResponse()->getStatusCode());

        $body = $this->get('/api/auth/sessions', $laptop['accessToken']);
        self::assertCount(2, $body['sessions'], 'the ended one is gone from the list');

        $this->refresh($phone['refreshToken']);
        self::assertSame(401, $this->client->getResponse()->getStatusCode(), 'and it cannot be refreshed');
    }

    #[Test]
    public function anotherAccountsSessionIsNotFound(): void
    {
        $mine = $this->signIn('mine@example.com');
        $theirs = $this->signIn('theirs@example.com');

        $this->client->request('DELETE', '/api/auth/sessions/' . $theirs['sessionId'], server: [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $mine['accessToken'],
        ]);

        self::assertSame(404, $this->client->getResponse()->getStatusCode());

        self::em()->clear();
        self::assertNull(
            $this->find($theirs['refreshToken'])?->getRevokedAt(),
            'and it is untouched',
        );
    }

    #[Test]
    public function anIdThatIsNotAUuidIsNotFoundRatherThanAnError(): void
    {
        ['accessToken' => $access] = $this->signIn('bad-id@example.com');

        $this->client->request('DELETE', '/api/auth/sessions/not-a-uuid', server: [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $access,
        ]);

        self::assertSame(404, $this->client->getResponse()->getStatusCode());
    }

    private function find(string $plain): ?RefreshToken
    {
        return self::service(RefreshTokenRepository::class)->findOneByHash(TokenIssuer::hash($plain));
    }

    /** @return array<string, mixed> */
    private function signIn(string $address): array
    {
        $this->account($address);

        return $this->signInExisting($address);
    }

    private function account(string $address): void
    {
        self::onboard(self::service(UserRegistrar::class)->register($address, 'Session', self::PASSWORD)->user);
    }

    /** @return array<string, mixed> */
    private function signInExisting(string $address): array
    {
        $this->client->request('POST', '/api/auth/login', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['email' => $address, 'password' => self::PASSWORD]));

        return $this->decode();
    }

    /** @return array<string, mixed> */
    private function refresh(#[SensitiveParameter] string $token): array
    {
        $this->client->request('POST', '/api/auth/refresh', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['refreshToken' => $token]));

        return $this->decode();
    }

    /** @return array{status: int, body: string} */
    private function rawRefresh(#[SensitiveParameter] string $token): array
    {
        $this->refresh($token);

        return [
            'status' => $this->client->getResponse()->getStatusCode(),
            'body' => Regex\replace(
                (string) $this->client->getResponse()->getContent(),
                '/"correlationId":"[^"]*"/',
                '',
            ),
        ];
    }

    /**
     * Another connection holds one session's chain, as a refresh in flight would.
     *
     * @param callable(string): mixed $request
     *
     * @return ?string the SQLSTATE the request on that session failed with, null if it was answered
     */
    private function whileTheChainIsHeld(callable $request): ?string
    {
        $this->client->disableReboot();
        $this->client->catchExceptions(false);
        ['refreshToken' => $held] = $this->signIn('held-chain@example.com');
        ['refreshToken' => $free] = $this->signInExisting('held-chain@example.com');
        $chain = $this->find($held)?->getChainId();
        self::assertNotNull($chain);

        $elsewhere = DriverManager::getConnection(self::em()->getConnection()->getParams());
        $elsewhere->beginTransaction();
        $elsewhere->executeStatement('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))', ['key' => TokenIssuer::lockFor($chain)]);
        self::em()->getConnection()->executeStatement("SET lock_timeout = '2s'");

        try {
            $request($free);
            self::assertLessThan(300, $this->client->getResponse()->getStatusCode(), 'another session of the account is not held up');

            try {
                $request($held);
            } catch (DriverException $e) {
                return $e->getSQLState();
            }

            return null;
        } finally {
            $elsewhere->rollBack();
            $elsewhere->close();
            self::em()->getConnection()->executeStatement('SET lock_timeout = 0');
        }
    }

    private function signOut(#[SensitiveParameter] string $token): void
    {
        $this->client->request('POST', '/api/auth/logout', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['refreshToken' => $token]));
    }

    /** @return array<string, mixed> */
    private function get(string $path, #[SensitiveParameter] string $accessToken): array
    {
        $this->client->request('GET', $path, server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $accessToken]);

        return $this->decode();
    }

    /** @return array<string, mixed> */
    private function decode(): array
    {
        $content = (string) $this->client->getResponse()->getContent();

        if ('' === $content) {
            return [];
        }

        return Json\typed($content, \Psl\Type\dict(\Psl\Type\string(), \Psl\Type\mixed()));
    }
}
