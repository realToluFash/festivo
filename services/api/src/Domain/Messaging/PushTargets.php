<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Messaging\Model\PushTarget;
use App\Enum\PushTargetKind;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Dict;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** The devices each member takes push on (sc-3980). An address belongs to whoever registered it last, under that session. */
final readonly class PushTargets
{
    /** Signed in: the target's session still has a live refresh token. The one definition both reads share. */
    private const string SIGNED_IN = <<<'SQL'
        EXISTS (
            SELECT 1 FROM refresh_tokens r
            WHERE r.chain_id = t.session_id AND r.user_id = t.user_id AND r.revoked_at IS NULL AND r.expires_at > :now
        )
        SQL;

    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
    ) {
    }

    public function register(Uuid $userId, Uuid $sessionId, PushTargetKind $kind, #[SensitiveParameter] string $address, ?string $publicKey = null, #[SensitiveParameter] ?string $authSecret = null): void
    {
        $this->connection->executeStatement(
            <<<'SQL'
                INSERT INTO push_targets (id, user_id, session_id, kind, address, public_key, auth_secret, created_at)
                VALUES (:id, :user, :session, :kind, :address, :publicKey, :authSecret, :now)
                ON CONFLICT (address) DO UPDATE
                SET user_id = EXCLUDED.user_id, session_id = EXCLUDED.session_id, kind = EXCLUDED.kind,
                    public_key = EXCLUDED.public_key, auth_secret = EXCLUDED.auth_secret, created_at = EXCLUDED.created_at
                SQL,
            [
                'id' => Uuid::v7()->toRfc4122(),
                'user' => $userId->toRfc4122(),
                'session' => $sessionId->toRfc4122(),
                'kind' => $kind->value,
                'address' => $address,
                'publicKey' => $publicKey,
                'authSecret' => $authSecret,
                'now' => $this->clock->now(),
            ],
            ['now' => Types::DATETIME_IMMUTABLE],
        );
    }

    /**
     * Only those whose session is still live: one that ran out unused is as good as signed out.
     *
     * @return list<PushTarget>
     */
    public function of(Uuid $userId): array
    {
        $rows = $this->connection->fetchAllAssociative(
            'SELECT t.id, t.user_id, t.kind, t.address, t.public_key, t.auth_secret FROM push_targets t WHERE t.user_id = :user AND ' . self::SIGNED_IN . ' ORDER BY t.id',
            ['user' => $userId->toRfc4122(), 'now' => $this->clock->now()],
            ['now' => Types::DATETIME_IMMUTABLE],
        );

        return Vec\map($rows, static fn (array $row): PushTarget => new PushTarget(
            Type\string()->coerce($row['id']),
            Type\string()->coerce($row['user_id']),
            PushTargetKind::from(Type\string()->coerce($row['kind'])),
            Type\string()->coerce($row['address']),
            Type\nullable(Type\string())->coerce($row['public_key']),
            Type\nullable(Type\string())->coerce($row['auth_secret']),
        ));
    }

    /**
     * Of these members, those signed in to the app with notifications allowed: a live session holding an Expo target (sc-4333).
     *
     * @return array<string, true> by the member's id
     */
    public function inApp(Uuid ...$userIds): array
    {
        if ([] === $userIds) {
            return [];
        }

        $ids = $this->connection->fetchFirstColumn(
            'SELECT DISTINCT t.user_id FROM push_targets t WHERE t.user_id IN (:users) AND t.kind = :expo AND ' . self::SIGNED_IN,
            ['users' => Vec\map($userIds, static fn (Uuid $id): string => $id->toRfc4122()), 'expo' => PushTargetKind::Expo->value, 'now' => $this->clock->now()],
            ['users' => ArrayParameterType::STRING, 'now' => Types::DATETIME_IMMUTABLE],
        );

        return Dict\from_keys(Vec\map($ids, static fn (mixed $id): string => Type\string()->coerce($id)), static fn (): true => true);
    }

    /** The provider said the device no longer takes it. */
    public function forget(string $id): void
    {
        $this->connection->executeStatement('DELETE FROM push_targets WHERE id = :id', ['id' => $id]);
    }

    public function forgetSessions(Uuid ...$sessions): void
    {
        if ([] === $sessions) {
            return;
        }

        $this->connection->executeStatement(
            'DELETE FROM push_targets WHERE session_id IN (:sessions)',
            ['sessions' => Vec\map($sessions, static fn (Uuid $session): string => $session->toRfc4122())],
            ['sessions' => ArrayParameterType::STRING],
        );
    }
}
