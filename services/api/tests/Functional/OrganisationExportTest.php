<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Export\OrganisationExports;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\OrganisationExport;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\OrganisationExportStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\InvitesPeople;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
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
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mime\Email;
use Symfony\Component\Uid\Uuid;
use ZipArchive;

/** Export all data (sc-612): one archive of the organisation, asked for by an Owner and downloaded once by them within 24 hours. */
final class OrganisationExportTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use InvitesPeople;
    use OnboardsAccounts;
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
        'event_people' => ['event_id', 'member_id', 'name', 'role', 'job_label'],
        'guests' => ['id', 'event_id', 'host_id', 'full_name', 'email', 'mobile', 'reply', 'replied_at', 'guest_group_id', 'allergens', 'diets', 'access_needs', 'needs_note', 'created_at'],
        'guest_groups' => ['id', 'event_id', 'name', 'created_at'],
        'seating_plans' => ['id', 'event_id', 'room_name', 'width_cm', 'length_cm', 'shared_at', 'share_by', 'created_at'],
        'seating_sections' => ['id', 'event_id', 'plan_id', 'name', 'colour'],
        'seating_tables' => ['id', 'event_id', 'plan_id', 'section_id', 'name', 'shape', 'seats', 'end_seats', 'unusable_seats', 'width_cm', 'length_cm', 'x_cm', 'y_cm', 'rotation'],
        'seating_rows' => ['id', 'event_id', 'plan_id', 'section_id', 'label', 'seats', 'unusable_seats', 'spacing_cm', 'x_cm', 'y_cm', 'rotation'],
        'seating_seats' => ['id', 'event_id', 'plan_id', 'section_id', 'name', 'unusable', 'x_cm', 'y_cm'],
        'seat_assignments' => ['event_id', 'guest_id', 'full_name', 'table_id', 'row_id', 'seat_id', 'seat'],
        'menu_courses' => ['id', 'event_id', 'position', 'name', 'served_time', 'guests_choose', 'skippable'],
        'menu_dishes' => ['id', 'course_id', 'library_dish_id', 'position', 'name', 'description', 'allergens', 'diets'],
        'menu_dish_variants' => ['id', 'dish_id', 'position', 'name', 'for_children', 'allergens', 'diets'],
        'menu_dish_choices' => ['id', 'dish_id', 'position', 'question', 'pick', 'required'],
        'menu_choice_options' => ['id', 'choice_id', 'position', 'name', 'allergens'],
        'dish_library' => ['id', 'name', 'description', 'allergens', 'diets', 'last_price_minor', 'last_price_currency', 'archived_at', 'created_at'],
        'dish_library_variants' => ['id', 'dish_id', 'position', 'name', 'for_children', 'allergens', 'diets', 'last_price_minor', 'last_price_currency'],
        'run_of_show' => ['id', 'event_id', 'title', 'starts_at', 'length_minutes', 'place', 'owner_name', 'owner_role', 'note', 'show_to_guests', 'skipped', 'started_at', 'ended_at'],
        'staff' => ['id', 'event_id', 'full_name', 'mobile', 'email', 'member_id'],
    ];

    private const array NEVER = ['calendar_feeds', 'screen_links', 'event_mutes', 'notification_preferences', 'event_changes', 'notification_deliveries', 'assistant_interactions', 'covers', 'photos'];

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
        $domain = new OrganisationDomain($this->fresh(), 'ire.events');
        $domain->setProvedAt(new DateTimeImmutable('2026-10-06T10:02:00+00:00'));
        self::em()->persist($domain);
        self::em()->flush();
        self::invitationTo('priya@ire.events', $this->fresh(), SeededRole::Member);
        $eventId = $this->newEvent();
        self::onEvent($admin, $eventId, EventRole::Lead);
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
        self::assertSame([$eventId, 'Julien Moreau', 'lead'], [$people[0]['event_id'], $people[0]['name'], $people[0]['role']]);
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
    public function theArchiveHoldsGuestNeedsAndGroupsSeatingTheMenuTheRunOfShowAndStaff(): void
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
        $course = $this->row('menu_courses', ['event_id' => $eventId, 'name' => 'Starters', 'served_at' => '19:30', 'position' => 1, 'guests_choose' => true, 'skippable' => false, ...$stamps]);
        $dish = $this->row('menu_dishes', ['course_id' => $course, 'library_dish_id' => $library, 'name' => 'Moi moi', 'allergens' => '["eggs","fish"]', 'diets' => '["halal"]', 'position' => 1, ...$stamps]);
        $this->row('menu_dish_variants', ['dish_id' => $dish, 'name' => 'Small', 'for_children' => true, 'allergens' => '["eggs"]', 'diets' => '[]', 'position' => 1, ...$stamps]);
        $choice = $this->row('menu_dish_choices', ['dish_id' => $dish, 'question' => 'Which sauce?', 'pick' => 1, 'required' => true, 'position' => 1, ...$stamps]);
        $this->row('menu_choice_options', ['choice_id' => $choice, 'name' => 'Pepper sauce', 'allergens' => '["celery"]', 'position' => 1, ...$stamps]);

        $this->row('schedule_items', ['event_id' => $eventId, 'title' => 'First dance', 'starts_at' => '2026-11-14 18:30:00', 'length_minutes' => 10, 'show_to_guests' => true, 'started_at' => '2026-11-14 17:34:00', 'ended_at' => '2026-11-14 17:45:00', ...$stamps]);
        $this->row('staff_members', ['event_id' => $eventId, 'full_name' => 'Kemi Bello', 'mobile' => '+2348030000001', 'email' => 'kemi@example.com', 'member_id' => $this->owner->getId()->toRfc4122(), ...$stamps]);

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
        self::assertSame(['Small', true], [$table('menu_dish_variants')[0]['name'], $table('menu_dish_variants')[0]['for_children']]);
        self::assertSame(['Which sauce?', 1, true], [$table('menu_dish_choices')[0]['question'], $table('menu_dish_choices')[0]['pick'], $table('menu_dish_choices')[0]['required']]);
        self::assertSame(['Pepper sauce', 'celery'], [$table('menu_choice_options')[0]['name'], $table('menu_choice_options')[0]['allergens']]);
        self::assertSame(['Moi moi', 'eggs', 250000, 'NGN', '2026-10-15T08:00:00Z'], [$table('dish_library')[0]['name'], $table('dish_library')[0]['allergens'], $table('dish_library')[0]['last_price_minor'], $table('dish_library')[0]['last_price_currency'], $table('dish_library')[0]['archived_at']]);
        self::assertSame('Small', $table('dish_library_variants')[0]['name']);
        self::assertSame(
            ['First dance', '2026-11-14T17:30:00Z', '2026-11-14T17:34:00Z', '2026-11-14T17:45:00Z', true],
            [$table('run_of_show')[0]['title'], $table('run_of_show')[0]['starts_at'], $table('run_of_show')[0]['started_at'], $table('run_of_show')[0]['ended_at'], $table('run_of_show')[0]['show_to_guests']],
        );
        $owner = Type\string()->coerce($connection->fetchOne('SELECT id FROM memberships WHERE user_id = ?', [$this->owner->getId()->toRfc4122()]));
        self::assertSame(['Kemi Bello', '+2348030000001', 'kemi@example.com', $owner], [$table('staff')[0]['full_name'], $table('staff')[0]['mobile'], $table('staff')[0]['email'], $table('staff')[0]['member_id']]);

        self::assertStringContainsString('"served_time": "19:30"', $files['archive.json']);
        foreach (self::TABLES as $name => $columns) {
            $lines = Str\split(Str\trim(Str\strip_prefix($files[$name . '.csv'], "\u{FEFF}")), "\r\n");
            self::assertSame(Str\join($columns, ','), $lines[0], $name);
            self::assertCount(Iter\count($table($name)) + 1, $lines, $name);
        }

        foreach (self::NEVER as $kept) {
            self::assertArrayNotHasKey($kept, $json);
            self::assertArrayNotHasKey($kept . '.csv', $files);
        }
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
        self::assertSame(['2026-10-18T13:20:00+00:00', 'Sunday 18 Oct at 14:20 WAT'], [$body['nextAllowedAt'], $body['nextAllowed']]);

        $mail = $this->mailTo('folake@ire.events');
        self::assertSame('Your export of Ìrè Events is ready', $mail->getSubject());
        self::assertStringContainsString('It downloads once, until Sunday 18 Oct at 14:20 WAT, and only for you, signed in.', (string) $mail->getTextBody());
        self::assertStringContainsString('/app/settings/data-and-control/export?download=' . $export->getId()->toRfc4122(), (string) $mail->getTextBody());
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
            $export->attemptFailed();
            self::assertSame($attempt < OrganisationExport::MOST_ATTEMPTS ? OrganisationExportStatus::Preparing : OrganisationExportStatus::Failed, $export->getStatus());
        }

        self::em()->flush();

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
        self::assertSame("Only an owner can export the organisation's data.", $this->last()['detail'] ?? null);
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

    /** @return array<string, string> each file in the archive by name, in the archive's order */
    private function archive(): array
    {
        $this->as($this->owner, 'POST', $this->path(''));
        self::assertSame(202, $this->statusCode(), Json\encode($this->last()));
        $this->download($this->owner, $this->latest()->getId()->toRfc4122());
        self::assertSame(200, $this->statusCode());

        $path = Filesystem\create_temporary_file(prefix: 'organisation-export-test-');

        try {
            File\write($path, (string) $this->client->getResponse()->getContent(), File\WriteMode::Truncate);
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
