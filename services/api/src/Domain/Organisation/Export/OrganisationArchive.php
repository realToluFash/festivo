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
use Psl\Filesystem;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use RuntimeException;
use ZipArchive;

/** Everything an organisation holds as one .zip (sc-612); a person's account gives only their name and address, as sc-611 rules. */
final readonly class OrganisationArchive
{
    private const int BATCH = 1_000;

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
            SELECT d.domain, e.proved_at, d.created_at
              FROM organisation_domains d
              LEFT JOIN organisation_email_domains e ON e.organisation_id = d.organisation_id AND e.domain = d.domain
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
            SELECT p.event_id,
                   CASE WHEN p.membership_id IS NOT NULL THEN 'member'
                        WHEN p.user_id IS NOT NULL THEN 'account'
                        ELSE 'address' END AS held_by,
                   p.membership_id AS member_id, u.name, p.address, p.address_kind, p.role, p.job_label
              FROM event_people p
              JOIN events ev ON ev.id = p.event_id
              LEFT JOIN memberships m ON m.id = p.membership_id
              LEFT JOIN users u ON u.id = COALESCE(m.user_id, p.user_id)
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, p.event_id, u.name NULLS LAST, p.address, p.id
            SQL,
        'guests' => <<<'SQL'
            SELECT g.id, g.event_id, g.host_id, g.full_name, g.email, g.mobile,
                   COALESCE(h.reply, g.reply, 'noReply') AS reply, COALESCE(h.replied_at, g.replied_at) AS replied_at,
                   COALESCE(g.group_id, h.group_id) AS guest_group_id,
                   (SELECT string_agg(CASE WHEN n.code = 'other' AND g.other_allergy IS NOT NULL THEN 'other: ' || g.other_allergy ELSE n.code END, ', ' ORDER BY n.code)
                      FROM guest_needs n WHERE n.guest_id = g.id AND n.kind = 'allergen') AS allergens,
                   (SELECT string_agg(CASE WHEN n.code = 'other' AND g.other_diet IS NOT NULL THEN 'other: ' || g.other_diet ELSE n.code END, ', ' ORDER BY n.code)
                      FROM guest_needs n WHERE n.guest_id = g.id AND n.kind = 'diet') AS diets,
                   (SELECT string_agg(CASE WHEN n.code = 'other' AND g.other_access IS NOT NULL THEN 'other: ' || g.other_access ELSE n.code END, ', ' ORDER BY n.code)
                      FROM guest_needs n WHERE n.guest_id = g.id AND n.kind = 'access') AS access_needs,
                   g.needs_note, g.created_at
              FROM guests g
              JOIN events ev ON ev.id = g.event_id
              LEFT JOIN guests h ON h.id = g.host_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL AND g.removed_at IS NULL
             ORDER BY ev.starts_at_utc, g.event_id, COALESCE(h.position, g.position), g.host_id NULLS FIRST, g.position, g.id
            SQL,
        'guest_groups' => <<<'SQL'
            SELECT gg.id, gg.event_id, gg.name, gg.created_at
              FROM guest_groups gg
              JOIN events ev ON ev.id = gg.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, gg.event_id, gg.name_key, gg.id
            SQL,
        'seating_plans' => <<<'SQL'
            SELECT p.id, p.event_id, p.room_name, p.width_cm, p.length_cm, t.shared_at, t.share_by, p.created_at
              FROM seating_plans p
              JOIN events ev ON ev.id = p.event_id
              LEFT JOIN table_sharings t ON t.plan_id = p.id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, p.event_id, p.id
            SQL,
        'seating_sections' => <<<'SQL'
            SELECT s.id, p.event_id, s.plan_id, s.name, s.colour
              FROM seating_sections s
              JOIN seating_plans p ON p.id = s.plan_id
              JOIN events ev ON ev.id = p.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, p.event_id, s.name_key, s.id
            SQL,
        'seating_tables' => <<<'SQL'
            SELECT t.id, p.event_id, t.plan_id, t.section_id, t.name, t.shape, t.seats, t.end_seats,
                   array_to_string(ARRAY(SELECT json_array_elements_text(t.unusable_seats)), ', ') AS unusable_seats,
                   t.width_cm, t.length_cm, t.x_cm, t.y_cm, t.rotation
              FROM seating_tables t
              JOIN seating_plans p ON p.id = t.plan_id
              JOIN events ev ON ev.id = p.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, p.event_id, t.name_key, t.id
            SQL,
        'seating_rows' => <<<'SQL'
            SELECT r.id, p.event_id, r.plan_id, r.section_id, r.label, r.seats,
                   array_to_string(ARRAY(SELECT json_array_elements_text(r.unusable_seats)), ', ') AS unusable_seats,
                   r.spacing_cm, r.x_cm, r.y_cm, r.rotation
              FROM seating_rows r
              JOIN seating_plans p ON p.id = r.plan_id
              JOIN events ev ON ev.id = p.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, p.event_id, r.label_key, r.id
            SQL,
        'seating_seats' => <<<'SQL'
            SELECT s.id, p.event_id, s.plan_id, s.section_id, s.name, s.unusable, s.x_cm, s.y_cm
              FROM seating_seats s
              JOIN seating_plans p ON p.id = s.plan_id
              JOIN events ev ON ev.id = p.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, p.event_id, s.name_key, s.id
            SQL,
        'seat_assignments' => <<<'SQL'
            SELECT a.event_id, a.guest_id, g.full_name, a.table_id, a.row_id, a.single_seat_id AS seat_id, a.seat
              FROM seat_assignments a
              JOIN events ev ON ev.id = a.event_id
              JOIN guests g ON g.id = a.guest_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL AND g.removed_at IS NULL
             ORDER BY ev.starts_at_utc, a.event_id, a.place_id, a.seat
            SQL,
        'menu_courses' => <<<'SQL'
            SELECT c.id, c.event_id, c.position, c.name, c.served_at AS served_time, c.guests_choose, c.skippable
              FROM menu_courses c
              JOIN events ev ON ev.id = c.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, c.event_id, c.position, c.id
            SQL,
        'menu_course_items' => <<<'SQL'
            SELECT c.id AS course_id, i.position, i.name
              FROM menu_courses c
              JOIN events ev ON ev.id = c.event_id
             CROSS JOIN LATERAL json_array_elements_text(c.own_items) WITH ORDINALITY AS i(name, position)
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, c.event_id, c.position, c.id, i.position
            SQL,
        'menu_dishes' => <<<'SQL'
            SELECT d.id, d.course_id, d.library_dish_id, d.position, d.name, d.description,
                   array_to_string(ARRAY(SELECT json_array_elements_text(d.allergens)), ', ') AS allergens, array_to_string(ARRAY(SELECT json_array_elements_text(d.diets)), ', ') AS diets,
                   d.cost_minor, CASE WHEN d.cost_minor IS NOT NULL THEN ev.currency END AS cost_currency
              FROM menu_dishes d
              JOIN menu_courses c ON c.id = d.course_id
              JOIN events ev ON ev.id = c.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, c.event_id, c.position, d.position, d.id
            SQL,
        'menu_dish_items' => <<<'SQL'
            SELECT d.id AS dish_id, i.position, i.item->>'kind' AS kind,
                   CASE i.item->>'kind' WHEN 'fixed' THEN i.item->>'name' WHEN 'choice' THEN q.question END AS name,
                   q.id AS choice_id
              FROM menu_dishes d
              JOIN menu_courses c ON c.id = d.course_id
              JOIN events ev ON ev.id = c.event_id
             CROSS JOIN LATERAL json_array_elements(d.items) WITH ORDINALITY AS i(item, position)
              LEFT JOIN menu_dish_choices q ON q.dish_id = d.id AND q.id::text = i.item->>'choiceId'
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, c.event_id, c.position, d.position, d.id, i.position
            SQL,
        'menu_dish_variants' => <<<'SQL'
            SELECT v.id, v.dish_id, v.position, v.name, v.for_children,
                   array_to_string(ARRAY(SELECT json_array_elements_text(v.allergens)), ', ') AS allergens, array_to_string(ARRAY(SELECT json_array_elements_text(v.diets)), ', ') AS diets,
                   v.cost_minor, CASE WHEN v.cost_minor IS NOT NULL THEN ev.currency END AS cost_currency
              FROM menu_dish_variants v
              JOIN menu_dishes d ON d.id = v.dish_id
              JOIN menu_courses c ON c.id = d.course_id
              JOIN events ev ON ev.id = c.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, c.event_id, c.position, d.position, v.position, v.id
            SQL,
        'menu_dish_choices' => <<<'SQL'
            SELECT q.id, q.dish_id, q.position, q.question, q.pick, q.required
              FROM menu_dish_choices q
              JOIN menu_dishes d ON d.id = q.dish_id
              JOIN menu_courses c ON c.id = d.course_id
              JOIN events ev ON ev.id = c.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, c.event_id, c.position, d.position, q.position, q.id
            SQL,
        'menu_choice_options' => <<<'SQL'
            SELECT o.id, o.choice_id, o.position, o.name, array_to_string(ARRAY(SELECT json_array_elements_text(o.allergens)), ', ') AS allergens
              FROM menu_choice_options o
              JOIN menu_dish_choices q ON q.id = o.choice_id
              JOIN menu_dishes d ON d.id = q.dish_id
              JOIN menu_courses c ON c.id = d.course_id
              JOIN events ev ON ev.id = c.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, c.event_id, c.position, d.position, q.position, o.position, o.id
            SQL,
        'dish_library' => <<<'SQL'
            SELECT d.id, d.name, d.description, array_to_string(ARRAY(SELECT json_array_elements_text(d.allergens)), ', ') AS allergens, array_to_string(ARRAY(SELECT json_array_elements_text(d.diets)), ', ') AS diets,
                   d.last_price_minor, d.last_price_currency, d.archived_at, d.created_at
              FROM dishes d
             WHERE d.organisation_id = :organisation
             ORDER BY d.archived_at NULLS FIRST, d.name, d.id
            SQL,
        'dish_library_variants' => <<<'SQL'
            SELECT v.id, v.dish_id, v.position, v.name, v.for_children,
                   array_to_string(ARRAY(SELECT json_array_elements_text(v.allergens)), ', ') AS allergens, array_to_string(ARRAY(SELECT json_array_elements_text(v.diets)), ', ') AS diets,
                   v.last_price_minor, v.last_price_currency
              FROM dish_variants v
              JOIN dishes d ON d.id = v.dish_id
             WHERE d.organisation_id = :organisation
             ORDER BY d.archived_at NULLS FIRST, d.name, d.id, v.position, v.id
            SQL,
        'vendors' => <<<'SQL'
            SELECT v.id, v.name, v.category, v.contact_name, v.email_address, v.phone_country_code, v.phone_number,
                   v.website, v.address, v.note, v.archived_at, v.created_at
              FROM vendors v
             WHERE v.organisation_id = :organisation
             ORDER BY v.archived_at NULLS FIRST, v.name, v.id
            SQL,
        'run_of_show' => <<<'SQL'
            SELECT s.id, s.event_id, s.title, (s.starts_at AT TIME ZONE ev.time_zone) AT TIME ZONE 'UTC' AS starts_at,
                   s.length_minutes, s.place, s.owner_name, s.owner_role, s.note, s.show_to_guests,
                   s.skipped, s.started_at, s.ended_at
              FROM schedule_items s
              JOIN events ev ON ev.id = s.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, s.event_id, s.starts_at, s.id
            SQL,
        'staff' => <<<'SQL'
            SELECT s.id, s.event_id, s.full_name, s.mobile, s.email, m.id AS member_id, s.job_id, s.station_id, s.as_well_station_id, s.floor_lead
              FROM staff_members s
              JOIN events ev ON ev.id = s.event_id
              LEFT JOIN memberships m ON m.user_id = s.member_id AND m.organisation_id = ev.organisation_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, s.event_id, s.full_name, s.id
            SQL,
        'staff_jobs' => <<<'SQL'
            SELECT j.id, j.event_id, j.name, j.access, j.position, j.created_at
              FROM staff_jobs j
              JOIN events ev ON ev.id = j.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, j.event_id, j.position, j.id
            SQL,
        'staff_shifts' => <<<'SQL'
            SELECT s.id, s.job_id, (s.starts_at AT TIME ZONE ev.time_zone) AT TIME ZONE 'UTC' AS starts_at,
                   (s.ends_at AT TIME ZONE ev.time_zone) AT TIME ZONE 'UTC' AS ends_at, s.needed
              FROM staff_shifts s
              JOIN staff_jobs j ON j.id = s.job_id
              JOIN events ev ON ev.id = j.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, j.event_id, j.position, s.starts_at, s.id
            SQL,
        'staff_shift_people' => <<<'SQL'
            SELECT p.shift_id, p.staff_member_id AS staff_id
              FROM staff_shift_people p
              JOIN staff_shifts s ON s.id = p.shift_id
              JOIN staff_jobs j ON j.id = s.job_id
              JOIN events ev ON ev.id = j.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, j.event_id, j.position, s.starts_at, s.id, p.staff_member_id
            SQL,
        'staff_stations' => <<<'SQL'
            SELECT t.id, t.event_id, t.kind, t.name, t.section_id, t.lead_id, t.position, t.walk_position
              FROM staff_stations t
              JOIN events ev ON ev.id = t.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, t.event_id, t.position, t.id
            SQL,
        'staff_item_stations' => <<<'SQL'
            SELECT i.course_id, i.item_key, i.station_id
              FROM staff_item_stations i
              JOIN staff_stations t ON t.id = i.station_id
              JOIN events ev ON ev.id = t.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL
             ORDER BY ev.starts_at_utc, t.event_id, i.course_id, i.item_key
            SQL,
        'cost_lines' => <<<'SQL'
            SELECT b.id, b.event_id, b.label, b.category, b.basis, b.price_minor,
                   CASE WHEN b.price_minor IS NOT NULL THEN ev.currency END AS price_currency, b.note, b.created_at, b.updated_at
              FROM budget_lines b
              JOIN events ev ON ev.id = b.event_id
             WHERE ev.organisation_id = :organisation AND ev.deleted_at IS NULL AND b.removed_at IS NULL
             ORDER BY ev.starts_at_utc, b.event_id, b.id
            SQL,
    ];

    /** Columns holding a date and time, written in UTC as `2026-11-05T14:20:07Z`. */
    private const array TIMES = [
        'created_at', 'proved_at', 'joined_at', 'expires_at', 'accepted_at', 'declined_at', 'revoked_at',
        'asked_at', 'starts_at', 'ends_at', 'replied_at', 'shared_at', 'archived_at', 'started_at', 'ended_at', 'updated_at',
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

    /** The .zip is written at $zipPath, every table read in pieces, so no table is ever held in memory whole; the pieces it is made from are gone once it returns. */
    public function write(Organisation $organisation, string $zipPath): void
    {
        $made = [];

        try {
            $jsonPath = Filesystem\create_temporary_file(prefix: 'organisation-export-');
            $made[] = $jsonPath;
            $json = self::open($jsonPath, 'wb');
            \fwrite($json, "{\n    \"exportedAt\": " . Json\encode(self::utc($this->clock->now())));
            $csvPaths = [];

            foreach (self::TABLES as $name => $sql) {
                $csvPath = Filesystem\create_temporary_file(prefix: 'organisation-export-');
                $made[] = $csvPath;
                $csvPaths[$name] = $csvPath;
                $this->table($organisation, $sql, $name, $json, $csvPath);
            }

            \fwrite($json, "\n}");
            \fclose($json);

            $zip = new ZipArchive();
            if (true !== $zip->open($zipPath, ZipArchive::OVERWRITE)) {
                throw new RuntimeException('The archive could not be opened for writing.');
            }

            $zip->addFile($jsonPath, 'archive.json');

            foreach ($csvPaths as $name => $csvPath) {
                $zip->addFile($csvPath, $name . '.csv');
            }

            if (!$zip->close()) {
                throw new RuntimeException('The archive could not be written.');
            }
        } finally {
            foreach ($made as $path) {
                Filesystem\delete_file($path);
            }
        }
    }

    /**
     * One table, a batch of rows at a time from a cursor: its .csv, and its list in archive.json, laid out as one pretty-printed document would be.
     *
     * @param resource $json
     */
    private function table(Organisation $organisation, string $sql, string $name, $json, string $csvPath): void
    {
        $csv = self::open($csvPath, 'wb');
        CsvFile::start($csv);
        \fwrite($json, ",\n    " . Json\encode($name) . ': [');
        $rows = 0;

        $this->connection->transactional(function () use ($organisation, $sql, $json, $csv, &$rows): void {
            $this->connection->executeStatement('DECLARE organisation_archive NO SCROLL CURSOR FOR ' . $sql, ['organisation' => $organisation->getId()->toRfc4122()]);

            do {
                $result = $this->connection->executeQuery(Str\format('FETCH FORWARD %d FROM organisation_archive', self::BATCH));

                if (0 === $rows) {
                    CsvFile::row($csv, Vec\map(Vec\range(0, $result->columnCount() - 1), $result->getColumnName(...)));
                }

                $batch = $result->fetchAllAssociative();

                foreach ($batch as $fetched) {
                    $row = self::row($fetched);
                    CsvFile::row($csv, Vec\map(Vec\values($row), self::cell(...)));
                    \fwrite($json, (0 === $rows ? "\n        " : ",\n        ") . Str\replace(Json\encode($row, pretty: true), "\n", "\n        "));
                    ++$rows;
                }
            } while (self::BATCH === Iter\count($batch));

            $this->connection->executeStatement('CLOSE organisation_archive');
        });

        \fwrite($json, 0 === $rows ? ']' : "\n    ]");
        \fclose($csv);
    }

    /** @return resource */
    private static function open(string $path, string $mode)
    {
        return \fopen($path, $mode) ?: throw new RuntimeException('A file of the archive could not be opened.');
    }

    /** Blank for nothing, true or false for a yes or no. */
    private static function cell(string|int|bool|null $value): string
    {
        return match (true) {
            null === $value => '',
            true === $value => 'true',
            false === $value => 'false',
            default => (string) $value,
        };
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
