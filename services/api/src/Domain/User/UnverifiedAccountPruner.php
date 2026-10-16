<?php

declare(strict_types=1);

namespace App\Domain\User;

use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\ParameterType;
use Doctrine\DBAL\Types\Types;
use Psr\Clock\ClockInterface;

/** An account that never verified an address owns nothing, so after a week it goes and frees the address. */
final readonly class UnverifiedAccountPruner
{
    public const string LIFETIME = '7 days';

    public const int BATCH_SIZE = 1000;

    private const string NEVER_VERIFIED = <<<'SQL'
        created_at < :cutoff
        AND NOT EXISTS (
            SELECT 1 FROM email_addresses e WHERE e.user_id = users.id AND e.verified_at IS NOT NULL
        )
        SQL;

    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
    ) {
    }

    public function countPrunable(): int
    {
        $count = $this->connection->fetchOne(
            'SELECT COUNT(*) FROM users WHERE ' . self::NEVER_VERIFIED,
            ['cutoff' => $this->cutoff()],
            ['cutoff' => Types::DATETIME_IMMUTABLE],
        );

        return (int) $count;
    }

    /** Addresses, phones, codes and sessions go with each account, by the foreign keys' cascade. */
    public function prune(int $batchSize = self::BATCH_SIZE): int
    {
        $cutoff = $this->cutoff();
        $deleted = 0;

        do {
            $batch = (int) $this->connection->executeStatement(
                'DELETE FROM users WHERE id IN (SELECT id FROM users WHERE '
                . self::NEVER_VERIFIED
                . ' LIMIT :batch FOR UPDATE SKIP LOCKED)',
                ['cutoff' => $cutoff, 'batch' => $batchSize],
                ['cutoff' => Types::DATETIME_IMMUTABLE, 'batch' => ParameterType::INTEGER],
            );

            $deleted += $batch;
        } while ($batch === $batchSize);

        return $deleted;
    }

    private function cutoff(): DateTimeImmutable
    {
        return $this->clock->now()->modify('-' . self::LIFETIME);
    }
}
