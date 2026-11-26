<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Export\OrganisationArchive;
use App\Domain\Organisation\Export\OrganisationExportMailer;
use App\Domain\Organisation\Export\OrganisationExports;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\Mail\AccountLanguage;
use App\Domain\User\Mail\UserMailer;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Event;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\OrganisationExport;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\AccountOrigin;
use App\Enum\ContactKind;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\OrganisationExportStatus;
use App\Enum\SeededRole;
use App\Repository\OrganisationExportRepository;
use App\Storage\ObjectStore;
use App\Tests\ApiTestCase;
use App\Tests\Double\S3ClientWithAnotherTryFirst;
use App\Tests\Traits\InvitesPeople;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\ProvesDomains;
use App\Tests\Traits\PutsPeopleOnEvents;
use AsyncAws\Core\Configuration;
use DateTimeImmutable;
use Doctrine\DBAL\ParameterType;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\File;
use Psl\Filesystem;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use ReflectionClassConstant;
use RuntimeException;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mime\Email;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;
use ZipArchive;

/** Export all data (sc-612): one archive of the organisation, asked for by an Owner and downloaded once by them within 24 hours. */
final class OrganisationExportTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use InvitesPeople;
    use OnboardsAccounts;
    use ProvesDomains;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string ASKED_AT = '2026-10-17T13:20:00+00:00';

    private const array TABLES = [
        'organisation' => ['id', 'name', 'country_code', 'currency', 'timezone', 'contact_address', 'locale', 'provider_sign_in_only', 'inactivity_timeout_days', 'administrators_need_two_factor', 'created_at'],
        'company_domains' => ['domain', 'proved_at', 'created_at'],
        'members' => ['id', 'name', 'email', 'role', 'state', 'joined_at'],
        'invitations' => ['id', 'email', 'role', 'status', 'invited_by', 'created_at', 'expires_at', 'accepted_at', 'declined_at', 'revoked_at'],
        'requests_to_join' => ['id', 'name', 'email', 'message', 'asked_at', 'expires_at'],
        'events' => ['id', 'name', 'type', 'status', 'starts_at', 'ends_at', 'time_zone', 'currency', 'venue_name', 'venue_address', 'reply_by', 'created_at'],
        'event_people' => ['event_id', 'held_by', 'member_id', 'name', 'address', 'address_kind', 'role', 'job_label'],
        'guests' => ['id', 'event_id', 'host_id', 'full_name', 'email', 'mobile', 'reply', 'replied_at', 'guest_group_id', 'allergens', 'diets', 'access_needs', 'needs_note', 'created_at'],
        'guest_groups' => ['id', 'event_id', 'name', 'created_at'],
        'guest_messages' => ['id', 'event_id', 'audience', 'subject', 'body', 'created_by_name', 'created_at'],
        'saved_audiences' => ['id', 'event_id', 'name', 'conditions', 'created_at'],
        'seating_plans' => ['id', 'event_id', 'room_name', 'width_cm', 'length_cm', 'shared_at', 'share_by', 'created_at'],
        'seating_sections' => ['id', 'event_id', 'plan_id', 'name', 'colour'],
        'seating_tables' => ['id', 'event_id', 'plan_id', 'section_id', 'name', 'shape', 'seats', 'end_seats', 'unusable_seats', 'width_cm', 'length_cm', 'x_cm', 'y_cm', 'rotation'],
        'seating_rows' => ['id', 'event_id', 'plan_id', 'section_id', 'label', 'seats', 'unusable_seats', 'spacing_cm', 'x_cm', 'y_cm', 'rotation'],
        'seating_seats' => ['id', 'event_id', 'plan_id', 'section_id', 'name', 'unusable', 'x_cm', 'y_cm'],
        'seat_assignments' => ['event_id', 'guest_id', 'full_name', 'table_id', 'row_id', 'seat_id', 'seat'],
        'menu_courses' => ['id', 'event_id', 'position', 'name', 'served_time', 'guests_choose', 'skippable'],
        'menu_course_items' => ['course_id', 'position', 'name'],
        'menu_dishes' => ['id', 'course_id', 'library_dish_id', 'position', 'name', 'description', 'allergens', 'diets', 'cost_minor', 'cost_currency'],
        'menu_dish_items' => ['dish_id', 'position', 'kind', 'name', 'choice_id'],
        'menu_dish_variants' => ['id', 'dish_id', 'position', 'name', 'for_children', 'allergens', 'diets', 'cost_minor', 'cost_currency'],
        'menu_dish_choices' => ['id', 'dish_id', 'position', 'question', 'pick', 'required'],
        'menu_choice_options' => ['id', 'choice_id', 'position', 'name', 'allergens'],
        'meal_answers' => ['id', 'guest_id', 'course_id', 'kind', 'dish_id', 'variant_id', 'options', 'created_at', 'updated_at'],
        'dish_library' => ['id', 'name', 'description', 'allergens', 'diets', 'last_price_minor', 'last_price_currency', 'archived_at', 'created_at'],
        'dish_library_variants' => ['id', 'dish_id', 'position', 'name', 'for_children', 'allergens', 'diets', 'last_price_minor', 'last_price_currency'],
        'vendors' => ['id', 'name', 'category', 'contact_name', 'email_address', 'phone_country_code', 'phone_number', 'website', 'address', 'note', 'archived_at', 'created_at'],
        'run_of_show' => ['id', 'event_id', 'title', 'starts_at', 'length_minutes', 'place', 'owner_name', 'owner_role', 'note', 'show_to_guests', 'skipped', 'started_at', 'ended_at'],
        'staff' => ['id', 'event_id', 'full_name', 'mobile', 'email', 'member_id', 'job_id', 'station_id', 'as_well_station_id', 'floor_lead'],
        'staff_jobs' => ['id', 'event_id', 'name', 'access', 'position', 'created_at'],
        'staff_shifts' => ['id', 'job_id', 'starts_at', 'ends_at', 'needed'],
        'staff_shift_people' => ['shift_id', 'staff_id'],
        'staff_attendance' => ['shift_id', 'staff_id', 'clocked_in_at', 'clocked_out_at', 'corrected_in_at', 'in_corrected_by', 'corrected_out_at', 'out_corrected_by'],
        'staff_rates' => ['id', 'event_id', 'job_id', 'staff_id', 'pay', 'amount_minor', 'amount_currency', 'set_at'],
        'staff_stations' => ['id', 'event_id', 'kind', 'name', 'section_id', 'lead_id', 'position', 'walk_position'],
        'staff_item_stations' => ['course_id', 'item_key', 'station_id'],
        'cost_lines' => ['id', 'event_id', 'label', 'category', 'basis', 'price_minor', 'price_currency', 'note', 'markup_tenths', 'client_price_minor', 'client_price_currency', 'created_at', 'updated_at'],
        'cost_markups' => ['id', 'event_id', 'category', 'markup_tenths', 'created_at', 'updated_at'],
        'quotes' => ['id', 'event_id', 'vendor_id', 'covers', 'amount_minor', 'amount_currency', 'quoted_on', 'reference', 'superseded_at', 'created_at'],
        'scheduled_payments' => ['id', 'event_id', 'vendor_id', 'description', 'amount_minor', 'amount_currency', 'due_on', 'created_at'],
        'payers' => ['id', 'event_id', 'name', 'note', 'created_at', 'updated_at'],
        'cost_payers' => ['id', 'event_id', 'line_id', 'payer_id', 'split', 'value', 'value_currency', 'rest_payer_id'],
    ];

    /** Every table the archive does not read, and why: a new table fails the test below until it is in one or the other. */
    private const array NEVER = [
        'apple_app_attempts' => "sign-in credentials (sc-611's rule)",
        'assistant_interactions' => "the assistant's interaction log",
        'audit_entries' => 'the audit log, which Settings > Audit log exports (sc-611)',
        'audit_exports' => "Soirely's own records",
        'billing_accounts' => "billing: Soirely's own records, the terms it sells on (pm, 19 Nov)",
        'calendar_feeds' => 'a link that opens without signing in',
        'catalogue_versions' => "billing: Soirely's own records, the terms it sells on (pm, 19 Nov)",
        'doctrine_migration_versions' => "Soirely's own records",
        'email_suppressions' => "Soirely's own records",
        'event_changes' => 'change history',
        'event_covers' => 'photos',
        'door_code_redemptions' => 'a link that opens without signing in',
        'door_codes' => 'a link that opens without signing in',
        'event_mutes' => "notifications: one person's, or deliveries",
        'guest_complaints' => 'a keyed hash only, which shows nowhere and is in no export (pm, 25 Nov, sc-3942)',
        'guest_reply_changes' => 'change history',
        'guest_reply_looks' => "notifications: one person's, or deliveries",
        'join_offer_dismissals' => "a person's own account (sc-611's rule)",
        'known_devices' => "sign-in credentials (sc-611's rule)",
        'membership_transitions' => 'change history',
        'notification_deliveries' => "notifications: one person's, or deliveries",
        'notification_items' => "notifications: one person's, or deliveries",
        'notification_preferences' => "notifications: one person's, or deliveries",
        'organisation_exports' => "Soirely's own records",
        'owner_claims' => 'change history',
        'password_reset_tokens' => "sign-in credentials (sc-611's rule)",
        'password_set_codes' => "sign-in credentials (sc-611's rule)",
        'pending_registrations' => "a person's own account (sc-611's rule)",
        'phone_code_deliveries' => "sign-in credentials (sc-611's rule)",
        'phone_numbers' => "a person's own account (sc-611's rule)",
        'phone_sign_ins' => "sign-in credentials (sc-611's rule)",
        'provider_events' => "billing: Soirely's own records, the terms it sells on (pm, 19 Nov)",
        'provider_identities' => "sign-in credentials (sc-611's rule)",
        'push_targets' => "notifications: one person's, or deliveries",
        'recovery_codes' => "sign-in credentials (sc-611's rule)",
        'refresh_tokens' => "sign-in credentials (sc-611's rule)",
        'schedule_presses' => "change history: the run of show's presses",
        'service_firings' => "the night's service as it ran: its working state, like the run of show's presses",
        'service_items' => "the night's service as it ran: its working state, like the run of show's presses",
        'service_plates' => "the night's service as it ran: its working state, like the run of show's presses",
        'service_steps' => "the night's service as it ran: its working state, like the run of show's presses",
        'service_taps' => 'a write\'s key and first answer, kept 24 hours so a retried tap changes nothing',
        'service_trays' => "the night's service as it ran: its working state, like the run of show's presses",
        'scheduled_notifications' => "notifications: one person's, or deliveries",
        'schema_probes' => "Soirely's own records",
        'screen_links' => 'a link that opens without signing in',
        'staff_link_tokens' => 'a link that opens without signing in',
        'sign_in_proofs' => "sign-in credentials (sc-611's rule)",
        'passkey_challenges' => "sign-in credentials (sc-611's rule)",
        'passkeys' => "sign-in credentials (sc-611's rule)",
        'subscription_changes' => "billing: Soirely's own records, the terms it sells on (pm, 19 Nov)",
        'subscriptions' => "billing: Soirely's own records, the terms it sells on (pm, 19 Nov)",
        'two_factor_challenges' => "sign-in credentials (sc-611's rule)",
        'two_factor_factors' => "sign-in credentials (sc-611's rule)",
        'two_factor_recoveries' => "sign-in credentials (sc-611's rule)",
        'two_factor_recovery_handles' => "sign-in credentials (sc-611's rule)",
        'verification_challenges' => "sign-in credentials (sc-611's rule)",
        'usage_hold_releases' => "billing: Soirely's own records, the terms it sells on (pm, 19 Nov)",
        'usage_records' => "billing: Soirely's own records, the terms it sells on (pm, 19 Nov)",
        'usage_reservations' => "billing: Soirely's own records, the terms it sells on (pm, 19 Nov)",
        'usage_totals' => "billing: Soirely's own records, the terms it sells on (pm, 19 Nov)",
    ];

    private User $owner;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable(self::ASKED_AT));
        $this->owner = $this->account('folake@ire.events', 'Folake Adeyemi', 'Africa/Lagos');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function theArchiveHoldsEachAreasRecordsAsJsonAndAsACsvFilePerTable(): void
    {
        $admin = $this->member('julien@ire.events', 'Julien Moreau', SeededRole::Admin);
        $this->member('ada@ire.events', 'Ada Obi', SeededRole::Member, status: MembershipStatus::PendingApproval);
        self::em()->persist(new OrganisationDomain($this->fresh(), 'ire.events'));
        self::em()->flush();
        self::proveDomain($this->fresh(), 'ire.events', new DateTimeImmutable('2026-10-06T10:02:00+00:00'));
        self::invitationTo('priya@ire.events', $this->fresh(), SeededRole::Member);
        $eventId = $this->newEvent();
        self::onEvent($admin, $eventId, EventRole::Lead);
        $event = self::em()->find(Event::class, $eventId) ?? self::fail('no event');
        $caterer = $this->account('kemi@caterers.example', 'Kemi Bello', 'Africa/Lagos');
        self::em()->persist(EventPerson::outside($event, $caterer, EventRole::CanView, null, $this->owner));
        self::em()->persist(EventPerson::pending($event, 'lights@example.com', ContactKind::Email, EventRole::CanView, null, $this->owner));
        self::em()->flush();
        $this->as($this->owner, 'POST', "/api/events/{$eventId}/guests", [
            'fullName' => 'Bísí Adéwálé',
            'email' => 'bisi@example.com',
            'mobile' => ['countryCode' => 'NG', 'number' => '08031234567'],
            'companions' => [['fullName' => 'Tunde Adéwálé']],
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        $files = $this->archive();

        self::assertSame(['archive.json', ...Vec\map(Vec\keys(self::TABLES), static fn (string $table): string => $table . '.csv')], Vec\keys($files));
        $json = Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($files['archive.json']));
        $tables = Vec\map(Vec\keys(self::TABLES), static fn (string $table): array => Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($json[$table]));
        [$organisation, $domains, $members, $invitations, $requests, $events, $people, $guests] = Vec\slice($tables, 0, 8);

        self::assertSame('Ìrè Events', $organisation[0]['name']);
        self::assertSame(['ire.events', '2026-10-06T10:02:00Z'], [$domains[0]['domain'], $domains[0]['proved_at']]);
        self::assertSame([['Folake Adeyemi', 'folake@ire.events', 'Owner', 'active'], ['Julien Moreau', 'julien@ire.events', 'Admin', 'active']], Vec\map($members, static fn (array $row): array => [$row['name'], $row['email'], $row['role'], $row['state']]));
        self::assertSame(['priya@ire.events', 'Member', 'pending'], [$invitations[0]['email'], $invitations[0]['role'], $invitations[0]['status']]);
        self::assertSame(['Ada Obi', 'ada@ire.events'], [$requests[0]['name'], $requests[0]['email']]);
        self::assertSame(['Owambe', '2026-11-14T15:00:00Z'], [$events[0]['name'], $events[0]['starts_at']]);
        self::assertSame(
            [
                [$eventId, 'member', 'Julien Moreau', null, null, 'lead'],
                [$eventId, 'account', 'Kemi Bello', null, null, 'can_view'],
                [$eventId, 'address', null, 'lights@example.com', 'email', 'can_view'],
            ],
            Vec\map($people, static fn (array $row): array => [$row['event_id'], $row['held_by'], $row['name'], $row['address'], $row['address_kind'], $row['role']]),
        );
        self::assertSame(
            [['Bísí Adéwálé', 'bisi@example.com', '+2348031234567', null, 'noReply'], ['Tunde Adéwálé', null, null, $guests[0]['id'], 'noReply']],
            Vec\map($guests, static fn (array $row): array => [$row['full_name'], $row['email'], $row['mobile'], $row['host_id'], $row['reply']]),
        );

        foreach (self::TABLES as $table => $columns) {
            $lines = Str\split(Str\trim(Str\strip_prefix($files[$table . '.csv'], "\u{FEFF}")), "\r\n");
            self::assertSame(Str\join($columns, ','), $lines[0], $table);
            self::assertCount(Iter\count(Type\vec(Type\mixed())->coerce($json[$table])) + 1, $lines, $table);
        }

        self::assertStringContainsString('"Bísí Adéwálé",bisi@example.com,\'+2348031234567', $files['guests.csv']);
    }

    #[Test]
    public function theArchiveHoldsGuestNeedsAndGroupsSeatingTheMenuTheRunOfShowStaffAndCostLines(): void
    {
        $eventId = $this->newEvent();
        $at = '2026-10-16 09:00:00';
        $stamps = ['created_at' => $at, 'updated_at' => $at];
        $group = $this->row('guest_groups', ['event_id' => $eventId, 'name' => 'Bride’s family', 'name_key' => 'bride’s family', ...$stamps]);
        $this->as($this->owner, 'POST', "/api/events/{$eventId}/guests", ['fullName' => 'Bísí Adéwálé', 'companions' => [['fullName' => 'Tunde Adéwálé']]]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $connection = self::em()->getConnection();
        $guest = Type\string()->coerce($connection->fetchOne('SELECT id FROM guests WHERE host_id IS NULL'));
        $connection->update('guests', ['group_id' => $group, 'other_allergy' => 'kiwi', 'needs_note' => 'Sits near the door'], ['id' => $guest]);
        foreach ([['allergen', 'peanuts'], ['allergen', 'other'], ['diet', 'halal'], ['access', 'step_free']] as [$kind, $code]) {
            $this->row('guest_needs', ['guest_id' => $guest, 'kind' => $kind, 'code' => $code]);
        }

        $plan = $this->row('seating_plans', ['event_id' => $eventId, 'room_name' => 'Hall A', 'width_cm' => 2000, 'length_cm' => 1500, ...$stamps]);
        $this->row('table_sharings', ['plan_id' => $plan, 'shared_at' => '2026-10-16 12:00:00', 'share_by' => null]);
        $section = $this->row('seating_sections', ['plan_id' => $plan, 'name' => 'Family', 'name_key' => 'family', 'colour' => 'gold', ...$stamps]);
        $table = $this->row('seating_tables', ['plan_id' => $plan, 'section_id' => $section, 'name' => 'Table 1', 'name_key' => 'table 1', 'shape' => 'round', 'seats' => 8, 'width_cm' => 180, 'length_cm' => 180, 'end_seats' => 0, 'rotation' => 0, 'x_cm' => 300, 'y_cm' => 300, 'unusable_seats' => '[3,4]', ...$stamps]);
        $this->row('seating_rows', ['plan_id' => $plan, 'section_id' => null, 'label' => 'A', 'label_key' => 'a', 'seats' => 10, 'spacing_cm' => 60, 'rotation' => 0, 'x_cm' => 100, 'y_cm' => 900, ...$stamps]);
        $this->row('seating_seats', ['plan_id' => $plan, 'section_id' => null, 'name' => 'Lectern', 'name_key' => 'lectern', 'x_cm' => 50, 'y_cm' => 50, ...$stamps]);
        $this->row('seat_assignments', ['event_id' => $eventId, 'plan_id' => $plan, 'guest_id' => $guest, 'table_id' => $table, 'place_id' => $table, 'seat' => 2]);

        $library = $this->row('dishes', ['organisation_id' => $this->organisation->getId()->toRfc4122(), 'name' => 'Moi moi', 'allergens' => '["eggs"]', 'diets' => '[]', 'last_price_minor' => 250000, 'last_price_currency' => 'NGN', 'used_by_event' => true, 'archived_at' => '2026-10-15 08:00:00', ...$stamps]);
        $this->row('dish_variants', ['dish_id' => $library, 'name' => 'Small', 'for_children' => true, 'allergens' => '["eggs"]', 'diets' => '[]', 'position' => 1, ...$stamps]);
        $course = $this->row('menu_courses', ['event_id' => $eventId, 'name' => 'Starters', 'served_at' => '19:30', 'position' => 1, 'guests_choose' => true, 'skippable' => false, 'own_items' => '["Bread roll","Butter"]', ...$stamps]);
        $dish = $this->row('menu_dishes', ['course_id' => $course, 'library_dish_id' => $library, 'name' => 'Moi moi', 'allergens' => '["eggs","fish"]', 'diets' => '["halal"]', 'position' => 1, 'cost_minor' => 180000, ...$stamps]);
        $this->row('menu_dishes', ['course_id' => $course, 'library_dish_id' => null, 'name' => 'Puff puff', 'allergens' => '[]', 'diets' => '[]', 'position' => 2, ...$stamps]);
        $this->row('menu_dish_variants', ['dish_id' => $dish, 'name' => 'Small', 'for_children' => true, 'allergens' => '["eggs"]', 'diets' => '[]', 'position' => 1, 'cost_minor' => 90000, ...$stamps]);
        $choice = $this->row('menu_dish_choices', ['dish_id' => $dish, 'question' => 'Which sauce?', 'pick' => 1, 'required' => true, 'position' => 1, ...$stamps]);
        $connection->update('menu_dishes', ['items' => Json\encode([['kind' => 'fixed', 'name' => 'Plantain'], ['kind' => 'choice', 'choiceId' => $choice], ['kind' => 'variants']])], ['id' => $dish]);
        $this->row('menu_choice_options', ['choice_id' => $choice, 'name' => 'Pepper sauce', 'allergens' => '["celery"]', 'position' => 1, ...$stamps]);

        $this->row('schedule_items', ['event_id' => $eventId, 'title' => 'First dance', 'starts_at' => '2026-11-14 18:30:00', 'length_minutes' => 10, 'show_to_guests' => true, 'started_at' => '2026-11-14 17:34:00', 'ended_at' => '2026-11-14 17:45:00', ...$stamps]);
        $job = $this->row('staff_jobs', ['event_id' => $eventId, 'name' => 'Usher', 'name_key' => 'usher', 'access' => 'check_in', 'position' => 9, ...$stamps]);
        $staff = $this->row('staff_members', ['event_id' => $eventId, 'full_name' => 'Kemi Bello', 'mobile' => '+2348030000001', 'email' => 'kemi@example.com', 'member_id' => $this->owner->getId()->toRfc4122(), 'job_id' => $job, ...$stamps]);
        $shift = $this->row('staff_shifts', ['job_id' => $job, 'starts_at' => '2026-11-14 16:00:00', 'ends_at' => '2026-11-14 23:30:00', 'needed' => 3, ...$stamps]);
        $connection->insert('staff_shift_people', ['shift_id' => $shift, 'staff_member_id' => $staff]);
        $this->row('budget_lines', ['event_id' => $eventId, 'label' => 'Catering', 'category' => 'catering', 'basis' => 'per_head', 'price_minor' => 4800, 'note' => 'Three courses', 'client_price_minor' => 560000, 'created_at' => $at, 'updated_at' => '2026-10-16 10:00:00']);
        $this->row('budget_markups', ['event_id' => $eventId, 'category' => 'venue', 'markup_tenths' => 0, ...$stamps]);
        $this->row('budget_lines', ['event_id' => $eventId, 'label' => 'Staff', 'category' => 'staffing', 'basis' => 'per_staff_hour', 'price_minor' => null, 'note' => null, ...$stamps]);
        $currency = Type\string()->coerce($connection->fetchOne('SELECT currency FROM events WHERE id = ?', [$eventId]));

        $files = $this->archive();
        $json = Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($files['archive.json']));
        $table = static fn (string $name): array => Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($json[$name]);

        $guests = $table('guests');
        self::assertSame([$group, 'other: kiwi, peanuts', 'halal', 'step_free', 'Sits near the door'], [$guests[0]['guest_group_id'], $guests[0]['allergens'], $guests[0]['diets'], $guests[0]['access_needs'], $guests[0]['needs_note']]);
        self::assertSame($group, $guests[1]['guest_group_id'], 'a companion is in their host’s group');
        self::assertSame(['Bride’s family'], Vec\map($table('guest_groups'), static fn (array $row): mixed => $row['name']));
        self::assertSame(['Hall A', 2000, 1500, '2026-10-16T12:00:00Z'], [$table('seating_plans')[0]['room_name'], $table('seating_plans')[0]['width_cm'], $table('seating_plans')[0]['length_cm'], $table('seating_plans')[0]['shared_at']]);
        self::assertSame(['Family', 'gold'], [$table('seating_sections')[0]['name'], $table('seating_sections')[0]['colour']]);
        self::assertSame(['Table 1', $section, '3, 4'], [$table('seating_tables')[0]['name'], $table('seating_tables')[0]['section_id'], $table('seating_tables')[0]['unusable_seats']]);
        self::assertSame('A', $table('seating_rows')[0]['label']);
        self::assertSame('Lectern', $table('seating_seats')[0]['name']);
        self::assertSame([$guest, 'Bísí Adéwálé', $table('seating_tables')[0]['id'], 2], [$table('seat_assignments')[0]['guest_id'], $table('seat_assignments')[0]['full_name'], $table('seat_assignments')[0]['table_id'], $table('seat_assignments')[0]['seat']]);
        self::assertSame(['Starters', '19:30', true], [$table('menu_courses')[0]['name'], $table('menu_courses')[0]['served_time'], $table('menu_courses')[0]['guests_choose']]);
        self::assertSame(['Moi moi', $library, 'eggs, fish', 'halal'], [$table('menu_dishes')[0]['name'], $table('menu_dishes')[0]['library_dish_id'], $table('menu_dishes')[0]['allergens'], $table('menu_dishes')[0]['diets']]);
        self::assertSame([[180000, $currency], [null, null]], Vec\map($table('menu_dishes'), static fn (array $row): array => [$row['cost_minor'], $row['cost_currency']]));
        self::assertSame(
            [[$dish, 1, 'fixed', 'Plantain', null], [$dish, 2, 'choice', 'Which sauce?', $choice], [$dish, 3, 'variants', null, null]],
            Vec\map($table('menu_dish_items'), static fn (array $row): array => Vec\values($row)),
        );
        self::assertSame([[$course, 1, 'Bread roll'], [$course, 2, 'Butter']], Vec\map($table('menu_course_items'), static fn (array $row): array => Vec\values($row)));
        self::assertSame(['Small', true, 90000, $currency], [$table('menu_dish_variants')[0]['name'], $table('menu_dish_variants')[0]['for_children'], $table('menu_dish_variants')[0]['cost_minor'], $table('menu_dish_variants')[0]['cost_currency']]);
        self::assertSame(['Which sauce?', 1, true], [$table('menu_dish_choices')[0]['question'], $table('menu_dish_choices')[0]['pick'], $table('menu_dish_choices')[0]['required']]);
        self::assertSame(['Pepper sauce', 'celery'], [$table('menu_choice_options')[0]['name'], $table('menu_choice_options')[0]['allergens']]);
        self::assertSame(['Moi moi', 'eggs', 250000, 'NGN', '2026-10-15T08:00:00Z'], [$table('dish_library')[0]['name'], $table('dish_library')[0]['allergens'], $table('dish_library')[0]['last_price_minor'], $table('dish_library')[0]['last_price_currency'], $table('dish_library')[0]['archived_at']]);
        self::assertSame('Small', $table('dish_library_variants')[0]['name']);
        self::assertSame(
            ['First dance', '2026-11-14T17:30:00Z', '2026-11-14T17:34:00Z', '2026-11-14T17:45:00Z', true],
            [$table('run_of_show')[0]['title'], $table('run_of_show')[0]['starts_at'], $table('run_of_show')[0]['started_at'], $table('run_of_show')[0]['ended_at'], $table('run_of_show')[0]['show_to_guests']],
        );
        $owner = Type\string()->coerce($connection->fetchOne('SELECT id FROM memberships WHERE user_id = ?', [$this->owner->getId()->toRfc4122()]));
        self::assertSame([$staff, 'Kemi Bello', '+2348030000001', 'kemi@example.com', $owner, $job], [$table('staff')[0]['id'], $table('staff')[0]['full_name'], $table('staff')[0]['mobile'], $table('staff')[0]['email'], $table('staff')[0]['member_id'], $table('staff')[0]['job_id']]);
        $usher = Vec\values(Dict\filter($table('staff_jobs'), static fn (array $row): bool => $job === $row['id']));
        self::assertSame([[$job, $eventId, 'Usher', 'check_in', 9, '2026-10-16T09:00:00Z']], Vec\map($usher, static fn (array $row): array => Vec\values($row)));
        self::assertSame([[$shift, $job, '2026-11-14T15:00:00Z', '2026-11-14T22:30:00Z', 3]], Vec\map($table('staff_shifts'), static fn (array $row): array => Vec\values($row)));
        self::assertSame([[$shift, $staff]], Vec\map($table('staff_shift_people'), static fn (array $row): array => Vec\values($row)));

        self::assertSame(
            [['Catering', 'catering', 'per_head', 4800, $currency, 'Three courses', null, 560000, $currency, '2026-10-16T09:00:00Z', '2026-10-16T10:00:00Z'], ['Staff', 'staffing', 'per_staff_hour', null, null, null, null, null, null, '2026-10-16T09:00:00Z', '2026-10-16T09:00:00Z']],
            Vec\map($table('cost_lines'), static fn (array $row): array => Vec\values(Dict\drop($row, 2))),
        );
        self::assertSame([['venue', 0]], Vec\map($table('cost_markups'), static fn (array $row): array => [$row['category'], $row['markup_tenths']]));
        self::assertStringContainsString('"served_time": "19:30"', $files['archive.json']);
        foreach (self::TABLES as $name => $columns) {
            $lines = Str\split(Str\trim(Str\strip_prefix($files[$name . '.csv'], "\u{FEFF}")), "\r\n");
            self::assertSame(Str\join($columns, ','), $lines[0], $name);
            self::assertCount(Iter\count($table($name)) + 1, $lines, $name);
        }
    }

    #[Test]
    public function everyTableIsEitherReadByTheArchiveOrNamedWithTheReasonItIsLeftOut(): void
    {
        $sql = Str\join(Vec\values(Type\dict(Type\string(), Type\string())->coerce(new ReflectionClassConstant(OrganisationArchive::class, 'TABLES')->getValue())), "\n");
        $read = Vec\map(Regex\every_match($sql, '/\b(?:FROM|JOIN)\s+(\w+)/') ?? [], static fn (array $match): string => $match[1]);
        $tables = Type\vec(Type\string())->coerce(self::em()->getConnection()->fetchFirstColumn(<<<'SQL'
            SELECT table_name FROM information_schema.tables
             WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
             ORDER BY table_name
            SQL));

        self::assertSame([], Vec\values(Dict\diff($tables, $read, Vec\keys(self::NEVER))), 'a table neither in the archive nor in NEVER');
        self::assertSame([], Vec\values(Dict\intersect($read, Vec\keys(self::NEVER))), 'a table both in the archive and in NEVER');
        self::assertSame([], Vec\values(Dict\diff(Vec\keys(self::NEVER), $tables)), 'a table in NEVER that no longer exists');
    }

    #[Test]
    public function theArchiveHoldsTheOrganisationsVendorsArchivedOnesIncludedAndNoOtherOrganisations(): void
    {
        $at = '2026-10-16 09:00:00';
        $mine = $this->organisation->getId()->toRfc4122();
        $kept = $this->row('vendors', ['organisation_id' => $mine, 'name' => 'Ẹ̀wà Kitchen', 'category' => 'catering', 'contact_name' => 'Tayo Bello', 'email_address' => 'tayo@ewa.example', 'phone_number' => '08031234567', 'phone_country_code' => 'NG', 'website' => 'https://ewa.example', 'address' => '12 Allen Avenue, Ikeja', 'note' => 'Books a month ahead', 'archived_at' => null, 'created_at' => $at, 'updated_at' => $at]);
        $archived = $this->row('vendors', ['organisation_id' => $mine, 'name' => 'Bloom Florals', 'category' => 'flowers', 'archived_at' => '2026-10-15 08:00:00', 'created_at' => $at, 'updated_at' => $at]);
        $other = self::service(OrganisationFounder::class)->found($this->freshUser($this->owner), 'Ìrè Two', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->row('vendors', ['organisation_id' => $other->getId()->toRfc4122(), 'name' => 'Elsewhere Lights', 'category' => 'venue', 'created_at' => $at, 'updated_at' => $at]);

        $files = $this->archive();
        $json = Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($files['archive.json']));
        $vendors = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($json['vendors']);

        self::assertSame(
            [
                [$kept, 'Ẹ̀wà Kitchen', 'catering', 'Tayo Bello', 'tayo@ewa.example', 'NG', '08031234567', 'https://ewa.example', '12 Allen Avenue, Ikeja', 'Books a month ahead', null, '2026-10-16T09:00:00Z'],
                [$archived, 'Bloom Florals', 'flowers', null, null, null, null, null, null, null, '2026-10-15T08:00:00Z', '2026-10-16T09:00:00Z'],
            ],
            Vec\map($vendors, static fn (array $row): array => Vec\values($row)),
        );
        $lines = Str\split(Str\trim(Str\strip_prefix($files['vendors.csv'], "\u{FEFF}")), "\r\n");
        self::assertCount(3, $lines);
        self::assertStringContainsString('"Bloom Florals",flowers', $lines[2]);
        self::assertStringContainsString('2026-10-15T08:00:00Z', $lines[2]);
        self::assertStringNotContainsString('Elsewhere Lights', $files['archive.json']);
        self::assertStringNotContainsString('Elsewhere Lights', $files['vendors.csv']);
    }

    /** sc-611's rule: a person's own account gives only their name and the address they belong by. */
    #[Test]
    public function noTableHoldsAnythingOfAPersonsOwnAccountBeyondTheirNameAndAddress(): void
    {
        $files = $this->archive();
        $json = Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($files['archive.json']));

        foreach (self::TABLES as $table => $columns) {
            $rows = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($json[$table]);
            foreach ($rows as $row) {
                self::assertSame($columns, Vec\keys($row), $table);
            }
        }

        self::assertStringNotContainsString('password', Str\lowercase($files['archive.json']));
        self::assertStringNotContainsString('two_factor', $files['members.csv']);
    }

    #[Test]
    public function everyTimeInTheArchiveIsUtcInIso8601(): void
    {
        $this->newEvent();
        $files = $this->archive();

        $times = Regex\every_match($files['archive.json'], '/"(\w+_at|exportedAt)": "([^"]*)"/');
        self::assertNotEmpty($times);
        foreach ($times ?? [] as $time) {
            self::assertMatchesRegularExpression('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/', $time[2], $time[1]);
        }

        self::assertStringContainsString('"exportedAt": "2026-10-17T13:20:00Z"', $files['archive.json']);
    }

    #[Test]
    public function askingPreparesItAfterTheResponseAndEmailsTheOwnerALinkThatOpensSettings(): void
    {
        $asked = $this->as($this->owner, 'POST', $this->path(''));

        self::assertSame(202, $this->statusCode(), Json\encode($asked));
        $export = $this->latest();
        self::assertSame(OrganisationExportStatus::Ready, $export->getStatus());

        $body = $this->as($this->owner, 'GET', $this->path(''));
        $shown = Type\dict(Type\string(), Type\mixed())->coerce($body['export']);
        self::assertSame(['ready', true, 'Folake Adeyemi', 'Sunday 18 Oct at 14:20 WAT'], [$shown['state'], $shown['mine'], $shown['askedBy'], $shown['expires']]);
        self::assertSame(['2026-10-18T13:20:00+00:00', 'Sunday 18 Oct at 14:21 WAT'], [$body['nextAllowedAt'], $body['nextAllowed']]);

        $mail = $this->mailTo('folake@ire.events');
        self::assertSame('Your export of Ìrè Events is ready', $mail->getSubject());
        self::assertStringContainsString('which you asked for on Saturday 17 Oct at 14:20 WAT, is ready.', (string) $mail->getTextBody());
        self::assertStringContainsString('It downloads once, until Sunday 18 Oct at 14:20 WAT, and only for you, signed in.', (string) $mail->getTextBody());
        self::assertStringContainsString('/app/settings/data-and-control/export?download=' . $export->getId()->toRfc4122(), (string) $mail->getTextBody());
    }

    #[Test]
    public function theDownloadIsNamedForTheOrganisationWithAnySlashOrQuoteTakenOut(): void
    {
        $this->organisation->setName('Ìrè / Events "Lagos"');
        self::em()->flush();
        $this->as($this->owner, 'POST', $this->path(''));

        $this->download($this->owner, $this->latest()->getId()->toRfc4122());

        self::assertSame(200, $this->statusCode());
        self::assertSame("attachment; filename=export.zip; filename*=utf-8''%C3%8Cr%C3%A8%20-%20Events%20Lagos%202026-10-17.zip", $this->client->getResponse()->headers->get('Content-Disposition'));
    }

    #[Test]
    public function theDownloadWorksOnceForTheOwnerWhoAsked(): void
    {
        $this->as($this->owner, 'POST', $this->path(''));
        $id = $this->latest()->getId()->toRfc4122();

        $this->download($this->owner, $id);
        self::assertSame(200, $this->statusCode());
        self::assertSame('application/zip', $this->client->getResponse()->headers->get('Content-Type'));

        $this->download($this->owner, $id);
        self::assertSame([410, ErrorCode::ExportUsed->type()], [$this->statusCode(), $this->last()['type'] ?? null]);

        $state = Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'GET', $this->path(''))['export']);
        self::assertSame('used', $state['state']);
    }

    #[Test]
    public function anyoneElseIsToldTheDownloadIsNotThere(): void
    {
        $admin = $this->member('julien@ire.events', 'Julien Moreau', SeededRole::Admin);
        $otherOwner = $this->member('tola@ire.events', 'Tola Ade', SeededRole::Owner);
        $this->as($this->owner, 'POST', $this->path(''));
        $id = $this->latest()->getId()->toRfc4122();

        foreach ([$admin, $otherOwner] as $someone) {
            $this->download($someone, $id);
            self::assertSame(404, $this->statusCode());
        }

        $state = Type\dict(Type\string(), Type\mixed())->coerce($this->as($admin, 'GET', $this->path(''))['export']);
        self::assertSame(['ready', false, 'Folake Adeyemi'], [$state['state'], $state['mine'], $state['askedBy']]);

        $this->download($this->owner, $id);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function theDownloadEnds24HoursAfterTheArchiveIsReady(): void
    {
        $this->as($this->owner, 'POST', $this->path(''));
        $id = $this->latest()->getId()->toRfc4122();

        self::mockTime(new DateTimeImmutable('2026-10-18T13:20:00+00:00'));
        $this->download($this->owner, $id);

        self::assertSame([410, ErrorCode::ExportExpired->type()], [$this->statusCode(), $this->last()['type'] ?? null]);
        self::assertSame('expired', Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'GET', $this->path(''))['export'])['state']);
    }

    #[Test]
    public function aSecondExportWithin24HoursIsRefusedWith429AndRetryAfter(): void
    {
        $this->as($this->owner, 'POST', $this->path(''));
        self::mockTime(new DateTimeImmutable('2026-10-18T13:19:00+00:00'));

        $this->as($this->owner, 'POST', $this->path(''));

        self::assertSame([429, ErrorCode::TooManyAttempts->type()], [$this->statusCode(), $this->last()['type'] ?? null]);
        self::assertSame('Sunday 18 Oct at 14:21 WAT', $this->last()['retryAt'] ?? null);
        self::assertGreaterThan(0, Str\to_int((string) $this->client->getResponse()->headers->get('Retry-After')));
        self::assertCount(1, self::em()->getRepository(OrganisationExport::class)->findAll());
        self::assertSame('Sunday 18 Oct at 14:21 WAT', $this->as($this->owner, 'GET', $this->path(''))['nextAllowed']);

        self::mockTime(new DateTimeImmutable('2026-10-18T13:20:00+00:00'));
        $this->as($this->owner, 'POST', $this->path(''));
        self::assertSame(202, $this->statusCode());
    }

    #[Test]
    public function anExportThatDidNotFinishDoesNotCountTowardTheLimitAndEmailsNothing(): void
    {
        $export = new OrganisationExport($this->fresh(), $this->freshUser($this->owner), new DateTimeImmutable(self::ASKED_AT));
        self::em()->persist($export);
        foreach (Vec\range(1, OrganisationExport::MOST_ATTEMPTS) as $attempt) {
            $export->attempting(new DateTimeImmutable(self::ASKED_AT));
            self::em()->flush();
            self::service(OrganisationExportRepository::class)->claimFailed($export, new DateTimeImmutable(self::ASKED_AT));
            self::assertSame($attempt < OrganisationExport::MOST_ATTEMPTS ? OrganisationExportStatus::Preparing : OrganisationExportStatus::Failed, $export->getStatus());
        }

        $body = $this->as($this->owner, 'GET', $this->path(''));
        self::assertSame(['failed', null], [Type\dict(Type\string(), Type\mixed())->coerce($body['export'])['state'], $body['nextAllowedAt']]);
        self::assertSame(0, self::service(OrganisationExports::class)->prepareDue());
        self::assertSame([], Vec\filter(self::getMailerMessages(), static fn (object $message): bool => $message instanceof Email && Str\contains((string) $message->getSubject(), 'export')));

        $this->as($this->owner, 'POST', $this->path(''));
        self::assertSame(202, $this->statusCode());
    }

    #[Test]
    public function anExportStillPreparingIsTriedAgainInTheBackground(): void
    {
        $export = new OrganisationExport($this->fresh(), $this->freshUser($this->owner), new DateTimeImmutable(self::ASKED_AT));
        $export->attempting(new DateTimeImmutable(self::ASKED_AT));
        self::em()->persist($export);
        self::em()->flush();

        self::assertSame(0, self::service(OrganisationExports::class)->prepareDue());
        self::mockTime(new DateTimeImmutable('2026-10-17T13:25:00+00:00'));
        self::assertSame(1, self::service(OrganisationExports::class)->prepareDue());

        self::assertSame([OrganisationExportStatus::Ready, 2], [$export->getStatus(), $export->getAttempts()]);
        self::assertSame('Your export of Ìrè Events is ready', $this->mailTo('folake@ire.events')->getSubject());
    }

    #[Test]
    public function aTryUnderWayIsNotStartedAgainSoTheOwnerIsEmailedOnce(): void
    {
        $export = new OrganisationExport($this->fresh(), $this->freshUser($this->owner), new DateTimeImmutable(self::ASKED_AT));
        self::em()->persist($export);
        self::em()->flush();
        $first = self::em()->getConnection();
        $first->executeStatement("UPDATE organisation_exports SET attempts = 1, attempted_at = '2026-10-17 13:20:00' WHERE id = ?", [$export->getId()->toRfc4122()]);

        self::mockTime(new DateTimeImmutable('2026-10-17T13:24:00+00:00'));
        self::service(OrganisationExports::class)->prepare($export);

        self::assertSame([OrganisationExportStatus::Preparing, 1], [$this->latest()->getStatus(), $this->latest()->getAttempts()]);
        self::assertSame([], Vec\filter(self::getMailerMessages(), static fn (object $message): bool => $message instanceof Email && Str\contains((string) $message->getSubject(), 'export')));
    }

    #[Test]
    public function eachTryKeepsItsOwnArchiveAndOnceOneIsReadyNoLaterTryCanFinishIt(): void
    {
        $export = new OrganisationExport($this->fresh(), $this->freshUser($this->owner), new DateTimeImmutable(self::ASKED_AT));
        $export->attempting(new DateTimeImmutable(self::ASKED_AT));
        self::em()->persist($export);
        self::em()->flush();
        self::mockTime(new DateTimeImmutable('2026-10-17T13:25:00+00:00'));
        self::service(OrganisationExports::class)->prepareDue();
        $ready = [$this->latest()->getFileKey(), $this->latest()->getReadyAt()];
        self::assertStringEndsWith(Str\format('%s-2.zip', $export->getId()->toRfc4122()), (string) $ready[0]);

        self::em()->getConnection()->executeStatement('UPDATE organisation_exports SET attempts = 3 WHERE id = ?', [$export->getId()->toRfc4122()]);
        $export = $this->latest();

        $repository = self::service(OrganisationExportRepository::class);
        self::assertFalse($repository->claimReady($export, 'organisation-exports/slow.zip', new DateTimeImmutable('2026-10-17T13:31:00+00:00')));
        self::assertFalse($repository->claimFailed($export, new DateTimeImmutable('2026-10-17T13:31:00+00:00')));

        self::assertSame(OrganisationExportStatus::Ready, $this->latest()->getStatus());
        self::assertEquals($ready, [$this->latest()->getFileKey(), $this->latest()->getReadyAt()]);
    }

    #[Test]
    public function aTryThatLosesToAnotherDiscardsItsOwnArchiveAndLeavesTheWinners(): void
    {
        $export = new OrganisationExport($this->fresh(), $this->freshUser($this->owner), new DateTimeImmutable(self::ASKED_AT));
        $export->attempting(new DateTimeImmutable(self::ASKED_AT));
        self::em()->persist($export);
        self::em()->flush();
        $store = null;
        $key = static fn (int $attempt): string => Str\format('organisation-exports/%s/%s-%d.zip', $export->getOrganisation()->getId()->toRfc4122(), $export->getId()->toRfc4122(), $attempt);
        $winner = static function () use (&$store, $export, $key): void {
            $store?->keep($key(1), 'the first try', 'application/zip');
            self::service(OrganisationExportRepository::class)->claimReady($export, $key(1), new DateTimeImmutable('2026-10-17T13:25:00+00:00'));
        };
        $env = static fn (string $name): string => Type\string()->coerce($_SERVER[$name]);
        $slow = new S3ClientWithAnotherTryFirst(Configuration::create([
            'endpoint' => $env('STORAGE_ENDPOINT'),
            'region' => $env('STORAGE_REGION'),
            'accessKeyId' => $env('STORAGE_KEY'),
            'accessKeySecret' => $env('STORAGE_SECRET'),
            'pathStyleEndpoint' => 'true',
        ]), $winner);
        $store = new ObjectStore($slow, $env('STORAGE_BUCKET_PRIVATE'), $env('STORAGE_BUCKET_PUBLIC'), $env('STORAGE_PUBLIC_ENDPOINT'));
        self::getContainer()->set(ObjectStore::class, $store);
        self::mockTime(new DateTimeImmutable('2026-10-17T13:25:00+00:00'));

        self::assertSame(1, self::service(OrganisationExports::class)->prepareDue());

        self::assertSame([OrganisationExportStatus::Ready, $key(1)], [$this->latest()->getStatus(), $this->latest()->getFileKey()]);
        self::assertSame([true, false], [$store->exists($env('STORAGE_BUCKET_PRIVATE'), $key(1)), $store->exists($env('STORAGE_BUCKET_PRIVATE'), $key(2))]);
    }

    #[Test]
    public function anExportWhoseEmailFailsIsStillReadyAndTheNextOneIsPrepared(): void
    {
        $failing = new UserMailer(static fn () => throw new RuntimeException('The scheduler is down.'), self::service(TranslatorInterface::class), self::service(AccountLanguage::class), self::service(ClockInterface::class));
        self::getContainer()->set(OrganisationExportMailer::class, new OrganisationExportMailer($failing, 'https://soirely.test'));
        $exports = [];
        foreach ([$this->fresh(), self::service(OrganisationFounder::class)->found($this->freshUser($this->owner), 'Ìrè Two', 'NG', 'Africa/Lagos')] as $organisation) {
            $export = new OrganisationExport($organisation, $this->freshUser($this->owner), new DateTimeImmutable(self::ASKED_AT));
            $export->attempting(new DateTimeImmutable(self::ASKED_AT));
            self::em()->persist($export);
            $exports[] = $export;
        }
        self::em()->flush();
        self::mockTime(new DateTimeImmutable('2026-10-17T13:25:00+00:00'));

        self::assertSame(2, self::service(OrganisationExports::class)->prepareDue());

        self::assertTrue(self::em()->isOpen());
        self::assertSame([OrganisationExportStatus::Ready, OrganisationExportStatus::Ready], Vec\map($exports, static fn (OrganisationExport $export): OrganisationExportStatus => $export->getStatus()));
    }

    /** @return iterable<string, array{SeededRole}> */
    public static function notOwners(): iterable
    {
        yield 'an Admin' => [SeededRole::Admin];
        yield 'a Member' => [SeededRole::Member];
    }

    #[Test]
    #[DataProvider('notOwners')]
    public function onlyAnOwnerExports(SeededRole $role): void
    {
        $someone = $this->member('julien@ire.events', 'Julien Moreau', $role);

        $this->as($someone, 'POST', $this->path(''));

        self::assertSame([403, ErrorCode::OwnerRequired->type()], [$this->statusCode(), $this->last()['type'] ?? null]);
        self::assertSame('Only an owner can export the organisation’s data.', $this->last()['detail'] ?? null);
        self::assertCount(0, self::em()->getRepository(OrganisationExport::class)->findAll());
    }

    #[Test]
    public function aMemberCannotReadIt(): void
    {
        $member = $this->member('ana@ire.events', 'Ana Souza', SeededRole::Member);

        $this->as($member, 'GET', $this->path(''));

        self::assertSame(403, $this->statusCode());
    }

    /** One instant, written in each Owner's own zone. */
    #[Test]
    #[DataProvider('readers')]
    public function theExpiryIsTheSameInstantInEachOwnersZone(?string $zone, string $written): void
    {
        $owner = $this->freshUser($this->owner);
        $owner->setTimezone($zone);
        self::em()->flush();

        $this->as($this->owner, 'POST', $this->path(''));
        $shown = Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'GET', $this->path(''))['export']);

        self::assertSame(['2026-10-18T13:20:00+00:00', $written], [$shown['expiresAt'], $shown['expires']]);
    }

    /** @return iterable<string, array{?string, string}> */
    public static function readers(): iterable
    {
        yield 'Lagos' => ['Africa/Lagos', 'Sunday 18 Oct at 14:20 WAT'];
        yield 'London' => ['Europe/London', 'Sunday 18 Oct at 14:20 BST'];
        yield 'no zone' => [null, 'Sunday 18 Oct at 13:20 UTC'];
    }

    #[Test]
    public function eachExportAskedForAndEachDownloadIsAudited(): void
    {
        $this->as($this->owner, 'POST', $this->path(''));
        $this->download($this->owner, $this->latest()->getId()->toRfc4122());

        $actions = Vec\map(
            self::em()->getRepository(AuditEntry::class)->findBy(['subjectType' => 'Organisation', 'subjectId' => $this->organisation->getId()], ['occurredAt' => 'ASC']),
            static fn (AuditEntry $entry): string => $entry->getAction(),
        );

        self::assertSame([OrganisationExports::ASKED, OrganisationExports::DOWNLOADED], Vec\values(Vec\filter($actions, static fn (string $action): bool => Str\starts_with($action, 'organisation.export'))));
    }

    #[Test]
    public function anArchivesMemoryToPrepareAndToDownloadDoesNotGrowWithItsMembers(): void
    {
        $this->bulkMembers(2_000);
        [$smallPrepared, $smallDownloaded] = $this->archivePeaks(2_001);
        $this->bulkMembers(58_000);
        [$largePrepared, $largeDownloaded] = $this->archivePeaks(60_001);

        self::assertLessThan(4 * 1024 * 1024, $largePrepared['peak'] - $smallPrepared['peak'], 'some 25 MB more rows, and no more than 4 MB more memory at the peak to prepare');
        self::assertGreaterThan(8 * 1024 * 1024, $largeDownloaded['bytes'] - $smallDownloaded['bytes'], 'the larger archive is larger than the memory the test allows');
        self::assertLessThan(4 * 1024 * 1024, $largeDownloaded['peak'] - $smallDownloaded['peak'], 'no more than 4 MB more memory at the peak to download');
    }

    /** Members, each with a long name that does not compress, so the archive grows with them. */
    private function bulkMembers(int $count): void
    {
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->fresh(), 'seededAs' => SeededRole::Member]) ?? self::fail('no role');
        self::em()->getConnection()->executeStatement(<<<'SQL'
            WITH made AS (
                INSERT INTO users (id, name, origin, created_at, updated_at)
                SELECT gen_random_uuid(), md5(n || 'a') || md5(n || 'b') || md5(n || 'c') || md5(n || 'd') || md5(n || 'e') || md5(n || 'f'), :origin, NOW(), NOW()
                  FROM generate_series(1, :count) AS n
             RETURNING id
            ), addressed AS (
                INSERT INTO email_addresses (id, user_id, address, is_primary, created_at, updated_at)
                SELECT gen_random_uuid(), id, id || '@bulk.example', TRUE, NOW(), NOW() FROM made
            )
            INSERT INTO memberships (id, organisation_id, user_id, role_id, status, joined_at, created_at, updated_at)
            SELECT gen_random_uuid(), :organisation, id, :role, :status, NOW(), NOW(), NOW() FROM made
            SQL, [
            'origin' => AccountOrigin::SelfRegistered->value,
            'count' => $count,
            'organisation' => $this->organisation->getId()->toRfc4122(),
            'role' => $role->getId()->toRfc4122(),
            'status' => MembershipStatus::Active->value,
        ]);
        self::em()->getConnection()->executeStatement('ANALYZE users, email_addresses, memberships');
    }

    /** @return array{array{peak: int}, array{peak: int, bytes: int}} the memory one archive took to prepare, then to download whole */
    private function archivePeaks(int $members): array
    {
        $export = new OrganisationExport($this->fresh(), $this->freshUser($this->owner), new DateTimeImmutable());
        self::em()->persist($export);
        self::em()->flush();
        $exports = self::service(OrganisationExports::class);

        \gc_collect_cycles();
        $before = \memory_get_usage();
        \memory_reset_peak_usage();
        $exports->prepare($export);
        $prepared = ['peak' => \memory_get_peak_usage() - $before];
        self::assertSame(OrganisationExportStatus::Ready, $this->latest()->getStatus(), 'the archive of ' . $members . ' members is ready');

        \gc_collect_cycles();
        $before = \memory_get_usage();
        \memory_reset_peak_usage();
        $bytes = 0;
        $path = Filesystem\create_temporary_file(prefix: 'organisation-export-test-');

        try {
            $file = \fopen($path, 'wb') ?: self::fail('no file');

            foreach ($exports->download($this->fresh(), $export->getId()->toRfc4122(), $this->freshUser($this->owner))->chunks as $chunk) {
                $bytes += Str\Byte\length($chunk);
                \fwrite($file, $chunk);
            }

            \fclose($file);
            $downloaded = ['peak' => \memory_get_peak_usage() - $before, 'bytes' => $bytes];
            $zip = new ZipArchive();
            self::assertTrue($zip->open($path));
            $csv = Type\string()->coerce($zip->getFromName('members.csv'));
            $zip->close();
            self::assertSame($members + 1, Iter\count(Str\Byte\split(Str\Byte\trim($csv), "\r\n")), 'a heading and a row for each member');
        } finally {
            Filesystem\delete_file($path);
        }

        return [$prepared, $downloaded];
    }

    /** @return array<string, string> each file in the archive by name, in the archive's order */
    private function archive(): array
    {
        $this->as($this->owner, 'POST', $this->path(''));
        self::assertSame(202, $this->statusCode(), Json\encode($this->last()));
        $this->download($this->owner, $this->latest()->getId()->toRfc4122());
        self::assertSame(200, $this->statusCode());

        $path = Filesystem\create_temporary_file(prefix: 'organisation-export-test-');

        try {
            File\write($path, $this->client->getInternalResponse()->getContent(), File\WriteMode::Truncate);
            $zip = new ZipArchive();
            self::assertTrue($zip->open($path));
            $files = [];
            foreach (Vec\range(0, $zip->numFiles - 1) as $index) {
                $name = Type\string()->coerce($zip->getNameIndex($index));
                $files[$name] = Type\string()->coerce($zip->getFromIndex($index));
            }

            $zip->close();

            return $files;
        } finally {
            Filesystem\delete_file($path);
        }
    }

    /** @param array<string, string|int|bool|null> $values */
    private function row(string $table, array $values): string
    {
        $id = Uuid::v7()->toRfc4122();
        self::em()->getConnection()->insert($table, ['id' => $id, ...$values], Dict\map($values, static fn (mixed $value): ParameterType => \is_bool($value) ? ParameterType::BOOLEAN : ParameterType::STRING));

        return $id;
    }

    private function latest(): OrganisationExport
    {
        self::em()->clear();

        return self::em()->getRepository(OrganisationExport::class)->findOneBy([], ['askedAt' => 'DESC', 'id' => 'DESC']) ?? self::fail('no export');
    }

    private function mailTo(string $address): Email
    {
        $mails = Vec\filter(
            self::getMailerMessages(),
            static fn (object $message): bool => $message instanceof Email && $address === $message->getTo()[0]->getAddress() && Str\contains((string) $message->getSubject(), 'export'),
        );

        return Type\instance_of(Email::class)->coerce(Iter\last($mails) ?? self::fail('no email to ' . $address));
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', $this->path('', '/events'), [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2026-11-14T16:00',
            'endsAt' => '2026-11-15T02:00',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function download(User $user, string $id): void
    {
        $this->as($user, 'POST', $this->path('/' . $id . '/download'));
    }

    private function fresh(): Organisation
    {
        return self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
    }

    private function freshUser(User $user): User
    {
        return self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
    }

    private function account(string $address, string $name, ?string $zone = null): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        $user->setTimezone($zone);
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(
        string $address,
        string $name,
        SeededRole $seeded,
        ?string $zone = 'Africa/Lagos',
        MembershipStatus $status = MembershipStatus::Active,
    ): User {
        $user = $this->account($address, $name, $zone);
        $organisation = $this->fresh();
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $seeded]) ?? self::fail('no role');
        $membership = new Membership($organisation, $user, $role, $status->isEntry() ? $status : MembershipStatus::Active, new DateTimeImmutable());
        self::em()->persist($membership);
        self::em()->flush();

        return $user;
    }

    private function path(string $rest, string $area = '/export'): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . $area . $rest;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->freshUser($user)),
        ], content: null === $body ? null : Json\encode($body));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();
        $type = (string) $this->client->getResponse()->headers->get('Content-Type');

        return '' === $raw || !Str\contains($type, 'json') ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
