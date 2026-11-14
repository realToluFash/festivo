<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\ParameterType;
use Doctrine\DBAL\Types\Types;
use Psr\Clock\ClockInterface;

/** The bell keeps 90 days (Decided, 19 Oct): an item's title names guests and senders, so an older one is deleted, not hidden. */
final readonly class NotificationItemPruner
{
    public const string KEPT = 'P90D';

    public const int BATCH_SIZE = 1000;

    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
    ) {
    }

    public function keptSince(): DateTimeImmutable
    {
        return $this->clock->now()->sub(new DateInterval(self::KEPT));
    }

    public function countPrunable(): int
    {
        return (int) $this->connection->fetchOne(
            'SELECT COUNT(*) FROM notification_items WHERE created_at < :since',
            ['since' => $this->keptSince()],
            ['since' => Types::DATETIME_IMMUTABLE],
        );
    }

    public function prune(int $batchSize = self::BATCH_SIZE): int
    {
        $since = $this->keptSince();
        $deleted = 0;

        do {
            $batch = (int) $this->connection->executeStatement(
                <<<'SQL'
                    DELETE FROM notification_items
                    WHERE id IN (
                        SELECT id
                        FROM notification_items
                        WHERE created_at < :since
                        LIMIT :batch
                        FOR UPDATE SKIP LOCKED
                    )
                    SQL,
                ['since' => $since, 'batch' => $batchSize],
                ['since' => Types::DATETIME_IMMUTABLE, 'batch' => ParameterType::INTEGER],
            );
            $deleted += $batch;
        } while ($batch === $batchSize);

        return $deleted;
    }
}
