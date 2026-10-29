<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Domain\User\Model\SessionsEnded;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\ParameterType;
use Doctrine\DBAL\Types\Types;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\EventDispatcher\EventDispatcherInterface;

/** Expiry alone decides: an unexpired revoked row is what tells a replay from an unknown token. */
final readonly class RefreshTokenPruner
{
    /** Small enough that no batch holds its locks for long on a table every request reads. */
    public const int BATCH_SIZE = 1000;

    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
        private EventDispatcherInterface $eventDispatcher,
    ) {
    }

    public function countPrunable(): int
    {
        $count = $this->connection->fetchOne(
            'SELECT COUNT(*) FROM refresh_tokens WHERE expires_at < :now',
            ['now' => $this->clock->now()],
            ['now' => Types::DATETIME_IMMUTABLE],
        );

        return (int) $count;
    }

    public function prune(int $batchSize = self::BATCH_SIZE): int
    {
        $now = $this->clock->now();
        $deleted = 0;

        do {
            $chains = Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
                <<<'SQL'
                    DELETE FROM refresh_tokens
                    WHERE id IN (
                        SELECT id
                        FROM refresh_tokens
                        WHERE expires_at < :now
                        LIMIT :batch
                        FOR UPDATE SKIP LOCKED
                    )
                    RETURNING chain_id
                    SQL,
                ['now' => $now, 'batch' => $batchSize],
                ['now' => Types::DATETIME_IMMUTABLE, 'batch' => ParameterType::INTEGER],
            ));

            $batch = Iter\count($chains);
            $deleted += $batch;
            $this->endEmptied(Vec\unique($chains));
        } while ($batch === $batchSize);

        return $deleted;
    }

    /**
     * A session that lapsed unused ends here, so what other scopes keep for it goes too.
     *
     * @param list<string> $chains
     */
    private function endEmptied(array $chains): void
    {
        if ([] === $chains) {
            return;
        }

        $kept = Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
            'SELECT DISTINCT chain_id FROM refresh_tokens WHERE chain_id IN (:chains)',
            ['chains' => $chains],
            ['chains' => ArrayParameterType::STRING],
        ));
        $emptied = Vec\filter($chains, static fn (string $chain): bool => !Iter\contains($kept, $chain));

        if ([] !== $emptied) {
            $this->eventDispatcher->dispatch(new SessionsEnded(...Vec\map($emptied, Uuid::fromString(...))));
        }
    }
}
