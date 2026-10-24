<?php

declare(strict_types=1);

namespace App\Domain\User;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\ParameterType;
use Doctrine\DBAL\Types\Types;
use Psr\Clock\ClockInterface;

/** Expiry alone decides: an unexpired revoked row is what tells a replay from an unknown token. */
final readonly class RefreshTokenPruner
{
    /** Small enough that no batch holds its locks for long on a table every request reads. */
    public const int BATCH_SIZE = 1000;

    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
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
            $batch = (int) $this->connection->executeStatement(
                <<<'SQL'
                    DELETE FROM refresh_tokens
                    WHERE id IN (
                        SELECT id
                        FROM refresh_tokens
                        WHERE expires_at < :now
                        LIMIT :batch
                        FOR UPDATE SKIP LOCKED
                    )
                    SQL,
                ['now' => $now, 'batch' => $batchSize],
                ['now' => Types::DATETIME_IMMUTABLE, 'batch' => ParameterType::INTEGER],
            );

            $deleted += $batch;
        } while ($batch === $batchSize);

        return $deleted;
    }
}
