<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Messaging\PushTargets;
use App\Domain\User\RefreshTokenPruner;
use App\Domain\User\TokenIssuer;
use App\Domain\User\UserRegistrar;
use App\Entity\RefreshToken;
use App\Enum\PushTargetKind;
use App\Repository\RefreshTokenRepository;
use App\Tests\ApiTestCase;
use Doctrine\DBAL\Connection;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use SensitiveParameter;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Console\Tester\CommandTester;

final class RefreshTokenPruneTest extends ApiTestCase
{
    use ClockSensitiveTrait;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function anExpiredRowIsDeleted(): void
    {
        $token = $this->signIn('expired@example.com')['refreshToken'];

        self::mockTime('+31 days');
        $this->prune();

        self::assertNull($this->find($token));
    }

    /** Its push target holds an endpoint and a secret that nothing would ever send to again (sc-3980). */
    #[Test]
    public function aSessionThatLapsedUnusedTakesItsPushTargetWithIt(): void
    {
        $lapsed = self::service(UserRegistrar::class)->register('lapsed@example.com', 'Lapsed', self::PASSWORD)->user;
        $live = self::service(UserRegistrar::class)->register('live@example.com', 'Live', self::PASSWORD)->user;
        $lapsedSession = self::service(TokenIssuer::class)->issueFor($lapsed)->sessionId;
        $liveSession = self::service(TokenIssuer::class)->issueFor($live)->sessionId;
        self::em()->flush();
        $pushTargets = self::service(PushTargets::class);
        $pushTargets->register($lapsed->getId(), $lapsedSession, PushTargetKind::Expo, 'ExponentPushToken[lapsed]');
        $pushTargets->register($live->getId(), $liveSession, PushTargetKind::Expo, 'ExponentPushToken[live]');
        self::service(Connection::class)->executeStatement(
            "UPDATE refresh_tokens SET expires_at = now() - interval '1 day' WHERE chain_id = :chain",
            ['chain' => $lapsedSession->toRfc4122()],
        );

        $this->prune();

        self::assertSame(
            ['ExponentPushToken[live]'],
            self::service(Connection::class)->fetchFirstColumn('SELECT address FROM push_targets ORDER BY address'),
        );
    }

    #[Test]
    public function aRevokedRowThatHasNotExpiredIsKept(): void
    {
        $first = $this->signIn('revoked@example.com')['refreshToken'];
        $this->refresh($first);

        self::mockTime('+1 day');
        $this->prune();

        self::assertNotNull($this->find($first), 'a revoked row inside its lifetime is the replay window');
    }

    #[Test]
    public function aRevokedRowIsDeletedOnceItHasExpired(): void
    {
        $first = $this->signIn('revoked-expired@example.com')['refreshToken'];
        $this->refresh($first);

        self::mockTime('+31 days');
        $this->prune();

        self::assertNull($this->find($first));
    }

    #[Test]
    public function itDeletesMoreRowsThanOneBatchHolds(): void
    {
        $tokens = [];
        for ($i = 0; $i < 5; ++$i) {
            $tokens[] = $this->signIn('batch-' . $i . '@example.com')['refreshToken'];
        }

        self::mockTime('+31 days');
        $deleted = self::service(RefreshTokenPruner::class)->prune(2);

        self::assertGreaterThanOrEqual(5, $deleted);
        foreach ($tokens as $token) {
            self::assertNull($this->find($token));
        }
    }

    #[Test]
    public function aDryRunCountsAndDeletesNothing(): void
    {
        $token = $this->signIn('dry-run@example.com')['refreshToken'];

        self::mockTime('+31 days');
        $output = $this->prune(['--dry-run' => true]);

        self::assertMatchesRegularExpression('/Would delete [1-9]\d* expired refresh tokens\./', $output);
        self::assertNotNull($this->find($token));
    }

    #[Test]
    public function aSecondRunFindsNothing(): void
    {
        $this->signIn('twice@example.com');

        self::mockTime('+31 days');
        $this->prune();

        self::assertStringContainsString('Deleted 0 expired refresh tokens', $this->prune());
    }

    /** The regression this story guards: a prune that took revoked rows would turn a replay into an unknown token. */
    #[Test]
    public function aReplayAfterAPruneStillRevokesTheChain(): void
    {
        $first = $this->signIn('replayed@example.com')['refreshToken'];
        $newest = $this->refresh($first)['refreshToken'];

        self::mockTime('+1 day');
        $this->prune();

        $this->refresh($first);
        self::assertSame(401, $this->client->getResponse()->getStatusCode());

        $newestRow = $this->find($newest);
        self::assertNotNull($newestRow);
        self::em()->refresh($newestRow);
        self::assertNotNull($newestRow->getRevokedAt(), 'the replay revoked the newest token in the chain');
    }

    /** @param array<string, mixed> $input */
    private function prune(array $input = []): string
    {
        $application = new Application(self::$kernel ?? throw new LogicException('No kernel.'));
        $tester = new CommandTester($application->find('app:prune-refresh-tokens'));
        $tester->execute($input);
        $tester->assertCommandIsSuccessful();

        return $tester->getDisplay();
    }

    private function find(#[SensitiveParameter] string $plain): ?RefreshToken
    {
        self::em()->clear();

        return self::service(RefreshTokenRepository::class)->findOneByHash(TokenIssuer::hash($plain));
    }

    /** @return array{refreshToken: string} */
    private function signIn(string $address): array
    {
        self::service(UserRegistrar::class)->register($address, 'Pruned', self::PASSWORD);
        self::em()->flush();

        $this->client->request('POST', '/api/auth/login', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['email' => $address, 'password' => self::PASSWORD]));

        return $this->tokens();
    }

    /** @return array{refreshToken: string} */
    private function refresh(#[SensitiveParameter] string $token): array
    {
        $this->client->request('POST', '/api/auth/refresh', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['refreshToken' => $token]));

        if (200 !== $this->client->getResponse()->getStatusCode()) {
            return ['refreshToken' => ''];
        }

        return $this->tokens();
    }

    /** @return array{refreshToken: string} */
    private function tokens(): array
    {
        return Type\shape(['refreshToken' => Type\string()])
            ->coerce(Json\decode((string) $this->client->getResponse()->getContent()));
    }
}
