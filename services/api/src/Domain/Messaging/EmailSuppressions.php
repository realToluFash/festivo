<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Enum\MailProviderReport;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Dict;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** The addresses that take security mail only, after a hard bounce or a complaint, kept as their keyed hash alone (sc-93044). */
final readonly class EmailSuppressions
{
    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
        private EmailAddressHash $hash,
    ) {
    }

    public function isSuppressed(string $address): bool
    {
        return false !== $this->connection->fetchOne('SELECT 1 FROM email_suppressions WHERE address_hash = :hash', ['hash' => $this->hash->of($address)]);
    }

    /**
     * @param list<string> $addresses
     *
     * @return list<string> those of them suppressed, lowercased and trimmed
     */
    public function suppressedAmong(array $addresses): array
    {
        if ([] === $addresses) {
            return [];
        }

        $hashes = Dict\from_keys(Vec\map($addresses, EmailAddressHash::normalised(...)), $this->hash->of(...));
        $suppressed = Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
            'SELECT address_hash FROM email_suppressions WHERE address_hash IN (:hashes)',
            ['hashes' => Vec\values($hashes)],
            ['hashes' => ArrayParameterType::STRING],
        ));

        return Vec\keys(Dict\filter($hashes, static fn (string $hash): bool => Iter\contains($suppressed, $hash)));
    }

    /** A code typed for the address proves the mailbox works and that its owner wants mail there (sc-44949). */
    public function lift(string $address): void
    {
        $this->connection->executeStatement('DELETE FROM email_suppressions WHERE address_hash = :hash', ['hash' => $this->hash->of($address)]);
    }

    /** A complaint after a bounce is kept as the complaint. */
    public function suppress(string $address, MailProviderReport $report): void
    {
        $this->connection->executeStatement(
            <<<'SQL'
                INSERT INTO email_suppressions (address_hash, reason, suppressed_at) VALUES (:hash, :reason, :now)
                ON CONFLICT (address_hash) DO UPDATE SET reason = EXCLUDED.reason
                WHERE email_suppressions.reason <> :complained
                SQL,
            ['hash' => $this->hash->of($address), 'reason' => $report->value, 'now' => $this->clock->now(), 'complained' => MailProviderReport::Complained->value],
            ['now' => Types::DATETIME_IMMUTABLE],
        );
    }
}
