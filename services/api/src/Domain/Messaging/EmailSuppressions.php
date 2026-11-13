<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Enum\MailProviderReport;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Str;
use Psr\Clock\ClockInterface;

/** The addresses that take security mail only, after a hard bounce or a complaint. */
final readonly class EmailSuppressions
{
    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
    ) {
    }

    public function isSuppressed(string $address): bool
    {
        return false !== $this->connection->fetchOne('SELECT 1 FROM email_suppressions WHERE address = :address', ['address' => self::key($address)]);
    }

    /** A complaint after a bounce is kept as the complaint. */
    public function suppress(string $address, MailProviderReport $report): void
    {
        $this->connection->executeStatement(
            <<<'SQL'
                INSERT INTO email_suppressions (address, reason, suppressed_at) VALUES (:address, :reason, :now)
                ON CONFLICT (address) DO UPDATE SET reason = EXCLUDED.reason
                WHERE email_suppressions.reason <> :complained
                SQL,
            ['address' => self::key($address), 'reason' => $report->value, 'now' => $this->clock->now(), 'complained' => MailProviderReport::Complained->value],
            ['now' => Types::DATETIME_IMMUTABLE],
        );
    }

    private static function key(string $address): string
    {
        return Str\lowercase(Str\trim($address));
    }
}
