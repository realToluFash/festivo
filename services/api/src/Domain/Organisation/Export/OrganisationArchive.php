<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Export;

use App\Domain\Guest\Export\CsvFile;
use App\Entity\Organisation;
use App\Enum\SeededRole;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Psl\Dict;
use Psl\File;
use Psl\Filesystem;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use RuntimeException;
use ZipArchive;

/** Everything an organisation holds as one .zip (sc-612); a person's account gives only their name and address, as sc-611 rules. */
final readonly class OrganisationArchive
{
    /** Each table's file name, and the query whose columns are its headings, in order. */
    private const array TABLES = [
        'organisation' => <<<'SQL'
            SELECT o.id, o.name, o.country_code, o.currency, o.timezone, o.contact_address, o.locale,
                   o.provider_sign_in_only, o.inactivity_timeout_days, o.administrators_need_two_factor,
                   o.created_at
              FROM organisations o
             WHERE o.id = :organisation
            SQL,
        'company_domains' => <<<'SQL'
            SELECT d.domain, d.proved_at, d.created_at
              FROM organisation_domains d
             WHERE d.organisation_id = :organisation
             ORDER BY d.domain
            SQL,
        'members' => <<<'SQL'
            SELECT m.id, u.name, e.address AS email, r.seeded_as AS role, m.status AS state, m.joined_at
              FROM memberships m
              JOIN users u ON u.id = m.user_id
              JOIN roles r ON r.id = m.role_id
              LEFT JOIN email_addresses e ON e.user_id = u.id AND e.is_primary
             WHERE m.organisation_id = :organisation AND m.status <> 'pending_approval'
             ORDER BY m.joined_at NULLS LAST, m.id
            SQL,
        'invitations' => <<<'SQL'
            SELECT i.id, i.email, r.seeded_as AS role, i.status, b.name AS invited_by, i.created_at, i.expires_at,
                   i.accepted_at, i.declined_at, i.revoked_at
              FROM invitations i
              LEFT JOIN roles r ON r.id = i.role_id
              LEFT JOIN users b ON b.id = i.invited_by_id
             WHERE i.organisation_id = :organisation
             ORDER BY i.created_at, i.id
            SQL,
        'requests_to_join' => <<<'SQL'
            SELECT m.id, u.name, e.address AS email, m.request_message AS message, m.created_at AS asked_at,
                   m.request_expires_at AS expires_at
              FROM memberships m
              JOIN users u ON u.id = m.user_id
              LEFT JOIN email_addresses e ON e.user_id = u.id AND e.is_primary
             WHERE m.organisation_id = :organisation AND m.status = 'pending_approval'
             ORDER BY m.created_at, m.id
            SQL,
        'events' => <<<'SQL'
            SELECT ev.id, ev.name, ev.type, ev.status, ev.starts_at_utc AS starts_at, ev.ends_at_utc AS ends_at,
                   ev.time_zone, ev.currency, ev.venue_name, ev.venue_address, ev.reply_by, ev.created_at
              FROM events ev
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, ev.id
            SQL,
        'event_people' => <<<'SQL'
            SELECT p.event_id, p.membership_id AS member_id, u.name, p.role, p.job_label
              FROM event_people p
              JOIN events ev ON ev.id = p.event_id
              JOIN memberships m ON m.id = p.membership_id
              JOIN users u ON u.id = m.user_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, p.event_id, u.name, p.id
            SQL,
        'guests' => <<<'SQL'
            SELECT g.id, g.event_id, g.host_id, g.full_name, g.email, g.mobile,
                   COALESCE(h.reply, g.reply, 'noReply') AS reply, COALESCE(h.replied_at, g.replied_at) AS replied_at,
                   g.created_at
              FROM guests g
              JOIN events ev ON ev.id = g.event_id
              LEFT JOIN guests h ON h.id = g.host_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL AND g.removed_at IS NULL
             ORDER BY ev.starts_at_utc, g.event_id, COALESCE(h.position, g.position), g.host_id NULLS FIRST, g.position, g.id
            SQL,
    ];

    /** Columns holding a date and time, written in UTC as `2026-11-05T14:20:07Z`. */
    private const array TIMES = [
        'created_at', 'proved_at', 'joined_at', 'expires_at', 'accepted_at', 'declined_at', 'revoked_at',
        'asked_at', 'starts_at', 'ends_at', 'replied_at',
    ];

    private const array ROLES = [
        SeededRole::Owner->value => 'Owner',
        SeededRole::Admin->value => 'Admin',
        SeededRole::Member->value => 'Member',
    ];

    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
    ) {
    }

    /** The archive's bytes. */
    public function of(Organisation $organisation): string
    {
        $tables = $this->read($organisation);
        $path = Filesystem\create_temporary_file(prefix: 'organisation-export-');

        try {
            $zip = new ZipArchive();
            if (true !== $zip->open($path, ZipArchive::OVERWRITE)) {
                throw new RuntimeException('The archive could not be opened for writing.');
            }

            $zip->addFromString('archive.json', Json\encode([
                'exportedAt' => self::utc($this->clock->now()),
                ...Dict\map($tables, static fn (ArchiveTable $table): array => $table->rows),
            ], pretty: true));

            foreach ($tables as $name => $table) {
                $zip->addFromString($name . '.csv', CsvFile::of($table->lines()));
            }

            $zip->close();

            return File\read($path);
        } finally {
            Filesystem\delete_file($path);
        }
    }

    /** @return array<string, ArchiveTable> */
    public function read(Organisation $organisation): array
    {
        $id = $organisation->getId()->toRfc4122();

        return Dict\map(self::TABLES, function (string $sql) use ($id): ArchiveTable {
            $result = $this->connection->executeQuery($sql, ['organisation' => $id]);
            $columns = Vec\map(Vec\range(0, $result->columnCount() - 1), $result->getColumnName(...));

            return new ArchiveTable($columns, Vec\map($result->fetchAllAssociative(), self::row(...)));
        });
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, string|int|bool|null>
     */
    private static function row(array $row): array
    {
        return Dict\map_with_key($row, static function (string $column, mixed $value): string|int|bool|null {
            $value = Type\union(Type\string(), Type\int(), Type\bool(), Type\null())->coerce($value);

            if ('role' === $column && \is_string($value)) {
                return self::ROLES[$value] ?? $value;
            }

            if (\is_string($value) && Iter\contains(self::TIMES, $column)) {
                return self::utc(new DateTimeImmutable($value, new DateTimeZone('UTC')));
            }

            return $value;
        });
    }

    private static function utc(DateTimeImmutable $at): string
    {
        return $at->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
    }
}
