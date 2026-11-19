<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Audit\Auditor;
use App\Domain\Organisation\AuditLog\AuditExports;
use App\Domain\Organisation\EmailDomains\ManagedAccounts;
use App\Domain\Organisation\Export\PreparedFiles;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\Plan\PlanChanger;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\AuditExport;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\AuditExportStatus;
use App\Enum\AuditType;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\Plan;
use App\Enum\SeededRole;
use App\Repository\AuditFilter;
use App\Tests\ApiTestCase;
use App\Tests\Traits\InvitesPeople;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mime\Email;
use Symfony\Component\Uid\Uuid;

final class AuditLogTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use InvitesPeople;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function anOwnerAndAnAdminReadTheLogAndAMemberIsRefused(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $admin = $this->member('julien@ire.events', 'Julien Moreau');
        $this->join($organisation, $admin, SeededRole::Admin);
        $member = $this->member('ada@ire.events', 'Ada Obi');
        $this->join($organisation, $member, SeededRole::Member);
        $this->entry($organisation, 'membership.role_changed', $owner, '-1 hour');

        foreach ([$owner, $admin] as $reader) {
            $this->signIn($reader);
            $body = $this->send('GET', $this->path($organisation));
            self::assertResponseStatusCodeSame(200);
            self::assertSame('Ìrè Events', $body['organisation']);
            self::assertContains('membership.role_changed', $this->actions($body));
        }

        $this->signIn($member);
        $refused = $this->send('GET', $this->path($organisation));
        self::assertResponseStatusCodeSame(403);
        self::assertSame(ErrorCode::PermissionRequired->type(), $refused['type']);
        $this->send('POST', $this->path($organisation, 'exports'), ['format' => 'csv']);
        self::assertResponseStatusCodeSame(403);
    }

    #[Test]
    public function aFreeOrganisationIsRefusedTheLogAndTheExportAndKeepsRecording(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);

        $read = $this->send('GET', $this->path($organisation));
        self::assertResponseStatusCodeSame(403);
        self::assertSame(ErrorCode::PlanRequired->type(), $read['type']);
        $this->send('POST', $this->path($organisation, 'exports'), ['format' => 'jsonl']);
        self::assertResponseStatusCodeSame(403);

        $this->entry($organisation, 'organisation.ownership_transferred', $owner, '-10 days');
        $this->moveTo($organisation, Plan::Enterprise);
        $this->signIn($owner);
        self::assertContains('organisation.ownership_transferred', $this->actions($this->send('GET', $this->path($organisation))), 'entries from before Enterprise show');
    }

    #[Test]
    public function eachFilterNarrowsTheListAndTheyCombine(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $admin = $this->member('julien@ire.events', 'Julien Moreau');
        $this->join($organisation, $admin, SeededRole::Admin);
        $wedding = Uuid::v7();
        $this->entry($organisation, 'event.made_live', $owner, '-2 days', $wedding, 'Ada’s Wedding');
        $this->entry($organisation, 'event_person.removed', $admin, '-3 days', $wedding, 'Ada’s Wedding', 'Ada Obi');
        $this->entry($organisation, 'sign_in_rules.changed', $admin, '-20 days');
        $this->entry($organisation, 'event.created', $admin, '-40 days', Uuid::v7(), 'Ireti at 40');
        $this->signIn($owner);

        self::assertSame(['sign_in_rules.changed'], $this->actions($this->list($organisation, ['type' => 'security'])));
        self::assertSame(['event_person.removed', 'event.made_live'], Vec\reverse($this->actions($this->list($organisation, ['event' => $wedding->toRfc4122()]))));
        self::assertSame(['event_person.removed', 'sign_in_rules.changed', 'event.created'], $this->actions($this->list($organisation, ['person' => $admin->getId()->toRfc4122()])));
        self::assertSame(['event_person.removed'], $this->actions($this->list($organisation, ['person' => $admin->getId()->toRfc4122(), 'event' => $wedding->toRfc4122()])));
        self::assertSame(['event.made_live'], $this->actions($this->list($organisation, [
            'type' => 'events',
            'from' => new DateTimeImmutable('-5 days')->format('Y-m-d'),
            'to' => new DateTimeImmutable('-1 day')->format('Y-m-d'),
        ])), 'the date range keeps only what falls inside it');
        self::assertSame([], $this->actions($this->list($organisation, ['person' => $owner->getId()->toRfc4122(), 'type' => 'security'])));

        $removed = Iter\first(Vec\filter(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->list($organisation, ['event' => $wedding->toRfc4122()])['entries']), static fn (array $entry): bool => 'event_person.removed' === $entry['action'])) ?? self::fail('no entry');
        self::assertSame('Removed Ada Obi from Ada’s Wedding', $removed['what']);
        self::assertSame(['name' => 'Ada’s Wedding', 'eventId' => null, 'gone' => true], $removed['on']);
        self::assertSame(['kind' => 'person', 'name' => 'Julien Moreau', 'email' => 'julien@ire.events'], $removed['who']);
        self::assertSame('event_access', $removed['type']);
    }

    #[Test]
    public function theDownloadIsNamedForTheOrganisationWithAnySlashOrQuoteTakenOut(): void
    {
        self::mockTime(new DateTimeImmutable('2026-10-19T10:00:00Z'));
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè / Events "Lagos"');
        $this->signIn($owner);

        $this->export($organisation, 'csv');

        self::assertSame("attachment; filename=audit-log.csv; filename*=utf-8''%C3%8Cr%C3%A8%20-%20Events%20Lagos%20audit%20log%202026-10-19.csv", $this->client->getResponse()->headers->get('Content-Disposition'));
    }

    #[Test]
    public function aStartAfterTheEndIsRefusedOnTheEndDate(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);

        $body = $this->send('GET', $this->path($organisation) . '?from=2026-10-19&to=2026-10-01');

        self::assertResponseStatusCodeSame(422);
        self::assertSame('to', Type\shape(['violations' => Type\vec(Type\shape(['propertyPath' => Type\string()], true))], true)->coerce($body)['violations'][0]['propertyPath']);
    }

    #[Test]
    public function theLogNeverShowsAnotherOrganisationsEntriesAPersonsOwnAccountOrAnythingOlderThanAYear(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        [$other, $elsewhere] = $this->enterprise('ada@lumen.pt', 'Lumen');
        $this->entry($elsewhere, 'sign_in_rules.changed', $other, '-1 day');
        $this->entry($organisation, 'event.created', $owner, '-366 days', Uuid::v7(), 'Long ago');
        $this->entry($organisation, 'event.created', $owner, '-364 days', Uuid::v7(), 'Within the year');
        self::service(Auditor::class)->record('name.changed', 'Account', $owner->getId(), Actor::User, $owner->getId(), $owner->getName(), ['name' => ['Folake', 'Folake A.']]);
        self::service(EntityManagerInterface::class)->flush();
        $this->signIn($owner);

        $body = $this->send('GET', $this->path($organisation));
        $actions = $this->actions($body);
        self::assertNotContains('sign_in_rules.changed', $actions);
        self::assertNotContains('name.changed', $actions);
        $names = Vec\filter_nulls(Vec\map(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($body['entries']), static fn (array $entry): mixed => Type\nullable(Type\shape(['name' => Type\string()], true))->coerce($entry['on'])['name'] ?? null));
        self::assertContains('Within the year', $names);
        self::assertNotContains('Long ago', $names);

        $csv = $this->export($organisation, 'csv');
        self::assertStringContainsString('Within the year', $csv);
        self::assertStringNotContainsString('Long ago', $csv);
        self::assertStringNotContainsString('name.changed', $csv);
    }

    #[Test]
    public function anInvitationRefusedBecauseAnotherOrganisationManagesTheAddressShowsInTheInvitingOrganisationsLog(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        [$invitation] = self::invitationTo('bayo@acme.com', self::service(EntityManagerInterface::class)->find(Organisation::class, $organisation->getId()));
        self::service(Auditor::class)->record(ManagedAccounts::REFUSED, 'Invitation', $invitation->getId(), Actor::User, null, 'Bayo', ['path' => [null, MembershipChannel::Invitation->value], 'domain' => [null, 'acme.com']]);
        self::service(EntityManagerInterface::class)->flush();
        $this->signIn($owner);

        self::assertContains(ManagedAccounts::REFUSED, $this->actions($this->list($organisation, ['type' => AuditType::Members->value])));
        self::assertStringContainsString('The invitation to bayo@acme.com was refused', $this->export($organisation, 'csv'));
    }

    #[Test]
    public function entriesAboutAnEventsGuestsMenuSeatingScheduleStaffOrBudgetAreNeitherShownNorExported(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $eventId = Uuid::v7();
        $this->entry($organisation, 'event.created', $owner, '-2 hours', $eventId, 'Ada\'s Wedding');

        $planner = $this->member('tobi@ire.events', 'Tobi Planner');
        $seatingOnly = Uuid::v7();

        foreach (['guests.marked_invited', 'guest.removed', 'run_of_show.item_skipped', 'staff.contacts_erased', 'stations.walk_ordered', 'budget_line.added', 'seating.table_added', 'dish.added'] as $action) {
            $this->entry($organisation, $action, $owner, '-1 hour', $eventId, 'Ada\'s Wedding');
            $this->entry($organisation, $action, $planner, '-1 hour', $seatingOnly, 'Bola\'s Birthday');
        }

        $this->signIn($owner);

        $body = $this->list($organisation, []);
        self::assertSame([$owner->getId()->toRfc4122()], Vec\map(Type\vec(Type\shape(['id' => Type\string()], true))->coerce($body['people']), static fn (array $person): string => $person['id']));
        self::assertSame([$eventId->toRfc4122()], Vec\map(Type\vec(Type\shape(['id' => Type\string()], true))->coerce($body['events']), static fn (array $event): string => $event['id']));

        $listed = $this->actions($body);
        self::assertContains('event.created', $listed);
        self::assertSame([], Vec\values(Vec\filter($listed, static fn (string $action): bool => !AuditType::isListed($action))));
        self::assertSame(['event.created'], $this->actions($this->list($organisation, ['event' => $eventId->toRfc4122()])));

        foreach (['csv', 'jsonl'] as $format) {
            $export = $this->export($organisation, $format);
            self::assertStringContainsString('event.created', $export);

            foreach (['guests.', 'guest.', 'run_of_show.', 'staff.', 'stations.', 'budget_line.', 'seating.', 'dish.'] as $area) {
                self::assertStringNotContainsString($area, $export, $format);
            }
        }
    }

    #[Test]
    public function bothFormatsCarryTheCodeTheWordsAndTheInstantInUtcAndOnlySecurityEntriesSayWhereFrom(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);
        $this->client->request('PATCH', Str\format('/api/orgs/%s/sign-in-rules', $organisation->getId()->toRfc4122()), server: ['CONTENT_TYPE' => 'application/json', 'HTTP_USER_AGENT' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'REMOTE_ADDR' => '203.0.113.17'], content: Json\encode(['inactivityTimeoutDays' => 30]));
        self::assertResponseIsSuccessful();
        $changed = $this->audited('sign_in_rules.changed', $organisation);
        self::assertNotNull($changed->getUserAgent(), 'the device is recorded with a new entry');

        $lines = Vec\filter(Str\split(Str\trim($this->export($organisation, 'jsonl')), "\n"), static fn (string $line): bool => '' !== $line);
        $rows = Vec\map($lines, static fn (string $line): array => Type\dict(Type\string(), Type\nullable(Type\string()))->coerce(Json\decode($line)));
        $security = Iter\first(Vec\filter($rows, static fn (array $row): bool => 'sign_in_rules.changed' === $row['action'])) ?? self::fail('no row');
        self::assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', (string) $security['occurred_at']);
        self::assertSame('Changed the sign-in rules', $security['what']);
        self::assertSame('Sign-in and security', $security['type_name']);
        self::assertSame('203.0.113.17', $security['network_address']);
        self::assertSame('Safari on macOS', $security['device']);
        $other = Iter\first(Vec\filter($rows, static fn (array $row): bool => 'sign_in_rules.changed' !== $row['action'] && 'audit_log.exported' !== $row['action'])) ?? self::fail('no other row');
        self::assertNull($other['network_address']);
        self::assertNull($other['device']);

        $csv = $this->export($organisation, 'csv');
        self::assertStringStartsWith("\u{FEFF}occurred_at,type,type_name,action,what,who,who_email,on,changes,network_address,device,reference\r\n", $csv);
        self::assertStringContainsString('sign_in_rules.changed', $csv);
    }

    #[Test]
    public function tenThousandDownloadAtOnceAndOneMoreIsPreparedAndEmailedToTheExporterOnly(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $already = $this->listedCount($organisation);
        $this->bulk($organisation, $owner, 10_000 - $already);
        $this->signIn($owner);

        $this->client->request('POST', $this->path($organisation, 'exports'), server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['format' => 'csv']));
        self::assertResponseStatusCodeSame(200);
        self::assertSame(10_001, Iter\count(Str\split(Str\trim((string) $this->client->getResponse()->getContent()), "\r\n")), 'a heading and 10,000 rows');

        $this->signIn($owner);
        $this->client->request('POST', $this->path($organisation, 'exports'), server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['format' => 'jsonl']));
        self::assertResponseStatusCodeSame(202);
        $answered = Type\shape(['id' => Type\string(), 'count' => Type\int(), 'email' => Type\string()])->coerce(Json\decode((string) $this->client->getResponse()->getContent()));
        self::assertSame(10_001, $answered['count'], 'the first export is an entry of its own');
        self::assertSame('folake@ire.events', $answered['email']);
        $mails = Vec\filter(self::getMailerMessages(), static fn (object $message): bool => $message instanceof Email && Str\contains((string) $message->getSubject(), 'audit log is ready'));
        self::assertCount(1, $mails);

        $this->signIn($owner);
        $this->client->request('POST', $this->path($organisation, 'exports/' . $answered['id'] . '/download'));
        self::assertResponseStatusCodeSame(200);
        self::assertSame(10_001, Iter\count(Str\split(Str\trim($this->client->getInternalResponse()->getContent()), "\n")));

        $admin = $this->member('julien@ire.events', 'Julien Moreau');
        $this->join($organisation, $admin, SeededRole::Admin);
        $this->signIn($admin);
        $this->send('POST', $this->path($organisation, 'exports/' . $answered['id'] . '/download'));
        self::assertResponseStatusCodeSame(404);

        $exported = Vec\filter($this->entries($organisation), static fn (AuditEntry $entry): bool => AuditType::EXPORTED === $entry->getAction());
        self::assertCount(2, $exported);
        self::assertSame([null, 10_001], Iter\last($exported)?->getChanges()['rows']);
    }

    #[Test]
    public function aPreparedExportsMemoryToPrepareAndToDownloadDoesNotGrowWithItsRows(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $this->bulk($organisation, $owner, 1_000, 'a long note ' . Str\repeat('x', 2_000));
        [$small, $smallDownloaded] = $this->preparedPeak($organisation, $owner);
        $this->bulk($organisation, $owner, 14_000, 'a long note ' . Str\repeat('x', 2_000));
        [$large, $largeDownloaded] = $this->preparedPeak($organisation, $owner);

        self::assertLessThan(4 * 1024 * 1024, $large - $small, 'a file some 30 MB larger, and no more than 4 MB more memory at the peak');
        self::assertGreaterThan(25 * 1024 * 1024, $largeDownloaded['bytes'] - $smallDownloaded['bytes']);
        self::assertLessThan(4 * 1024 * 1024, $largeDownloaded['peak'] - $smallDownloaded['peak'], 'and no more than 4 MB more to download it');
    }

    #[Test]
    public function moreThanAMillionIsRefusedBeforeAnythingStarts(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $this->bulk($organisation, $owner, 1_000_001);
        $this->signIn($owner);

        $body = $this->send('POST', $this->path($organisation, 'exports'), ['format' => 'csv']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(ErrorCode::AuditExportTooMany->type(), $body['type']);
        self::assertSame(0, self::service(EntityManagerInterface::class)->getConnection()->fetchOne('SELECT COUNT(*) FROM audit_entries WHERE action = :action', ['action' => AuditType::EXPORTED]), 'nothing started, nothing recorded');
        self::assertSame(0, self::service(EntityManagerInterface::class)->getConnection()->fetchOne('SELECT COUNT(*) FROM audit_exports'));
    }

    #[Test]
    public function openingTheLogIsOneEntryAndFilteringOrLoadingMoreMakeNone(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $this->bulk($organisation, $owner, 60);
        $this->signIn($owner);

        $this->send('POST', $this->path($organisation, 'views'));
        self::assertResponseStatusCodeSame(204);
        $first = $this->list($organisation, []);
        self::assertCount(50, Type\vec(Type\mixed())->coerce($first['entries']));
        $next = Type\string()->coerce($first['next']);
        $second = $this->list($organisation, ['before' => $next]);
        self::assertNull($second['next']);
        $this->list($organisation, ['type' => 'events']);

        self::assertCount(1, Vec\filter($this->entries($organisation), static fn (AuditEntry $entry): bool => AuditType::VIEWED === $entry->getAction()));
        self::assertSame('audit_log', Type\dict(Type\string(), Type\mixed())->coerce(Type\vec(Type\mixed())->coerce($first['entries'])[0])['type']);
    }

    #[Test]
    public function nobodyCanChangeOrDeleteAnEntry(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);
        $entry = Iter\first($this->entries($organisation)) ?? self::fail('no entry');

        foreach (['PUT', 'PATCH', 'DELETE'] as $method) {
            $this->send($method, $this->path($organisation, $entry->getId()->toRfc4122()));
            self::assertContains($this->client->getResponse()->getStatusCode(), [404, 405], $method);
        }
    }

    /** @return array<string, mixed> */
    private function list(Organisation $organisation, array $query): array
    {
        $body = $this->send('GET', $this->path($organisation) . ([] === $query ? '' : '?' . \http_build_query($query)));
        self::assertResponseStatusCodeSame(200, Json\encode($body));

        return $body;
    }

    private function export(Organisation $organisation, string $format): string
    {
        $this->client->request('POST', $this->path($organisation, 'exports'), server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['format' => $format]));
        self::assertResponseStatusCodeSame(200);

        return (string) $this->client->getResponse()->getContent();
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return list<string>
     */
    private function actions(array $body): array
    {
        return Vec\map(Type\vec(Type\shape(['action' => Type\string()], true))->coerce($body['entries']), static fn (array $entry): string => $entry['action']);
    }

    private function entry(Organisation $organisation, string $action, User $by, string $ago, ?Uuid $eventId = null, ?string $eventName = null, ?string $target = null): void
    {
        $entityManager = self::service(EntityManagerInterface::class);
        $entityManager->persist(new AuditEntry(Actor::User, $by->getId(), $by->getName(), null === $eventId ? 'Organisation' : 'Event', $eventId ?? $organisation->getId(), $action, [], null, null, new DateTimeImmutable($ago), $organisation->getId(), $eventId, $eventName, $target ?? $eventName ?? $organisation->getName()));
        $entityManager->flush();
    }

    private function bulk(Organisation $organisation, User $by, int $count, ?string $note = null): void
    {
        self::service(EntityManagerInterface::class)->getConnection()->executeStatement(<<<'SQL'
            INSERT INTO audit_entries (id, occurred_at, actor_type, actor_id, actor_label, subject_type, subject_id, action, changes, organisation_id, target)
            SELECT gen_random_uuid(), NOW() - (n || ' seconds')::interval - INTERVAL '1 hour', 'user', :actor, :label, 'Organisation', :organisation, 'event.updated',
                   CASE WHEN CAST(:note AS text) IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('note', jsonb_build_array(NULL, CAST(:note AS text))) END, :organisation, 'Bulk'
            FROM   generate_series(1, :count) AS n
            SQL, ['actor' => $by->getId()->toRfc4122(), 'label' => $by->getName(), 'organisation' => $organisation->getId()->toRfc4122(), 'count' => $count, 'note' => $note]);
    }

    /** @return array{int, array{peak: int, bytes: int}} the memory to prepare the file, then to download it whole */
    private function preparedPeak(Organisation $organisation, User $by): array
    {
        $entityManager = self::service(EntityManagerInterface::class);
        $organisation = $entityManager->find(Organisation::class, $organisation->getId()) ?? self::fail('gone');
        $by = $entityManager->find(User::class, $by->getId()) ?? self::fail('gone');
        $export = new AuditExport($organisation, $by, new DateTimeImmutable(), 'csv', [], 0, 'en');
        $entityManager->persist($export);
        $entityManager->flush();

        \gc_collect_cycles();
        $before = \memory_get_usage();
        \memory_reset_peak_usage();
        self::service(AuditExports::class)->prepare($export, new AuditFilter($organisation->getId(), new DateTimeImmutable('-1 year')));
        $peak = \memory_get_peak_usage() - $before;

        self::assertSame(AuditExportStatus::Ready, $export->getStatus());

        \gc_collect_cycles();
        $before = \memory_get_usage();
        \memory_reset_peak_usage();
        $files = self::service(PreparedFiles::class);
        $bytes = 0;

        foreach ($files->chunks(self::service(AuditExports::class)->download($organisation, $export->getId()->toRfc4122(), $by)) as $chunk) {
            $bytes += Str\Byte\length($chunk);
        }

        return [$peak, ['peak' => \memory_get_peak_usage() - $before, 'bytes' => $bytes]];
    }

    private function listedCount(Organisation $organisation): int
    {
        return Iter\count(Vec\filter($this->entries($organisation), static fn (AuditEntry $entry): bool => AuditType::isListed($entry->getAction())));
    }

    /** @return list<AuditEntry> oldest first */
    private function entries(Organisation $organisation): array
    {
        $entityManager = self::service(EntityManagerInterface::class);
        $entityManager->clear();

        return Type\vec(Type\instance_of(AuditEntry::class))->coerce($entityManager->getRepository(AuditEntry::class)->findBy(['organisationId' => $organisation->getId()], ['occurredAt' => 'ASC', 'id' => 'ASC']));
    }

    private function audited(string $action, Organisation $organisation): AuditEntry
    {
        return Iter\last(Vec\filter($this->entries($organisation), static fn (AuditEntry $entry): bool => $action === $entry->getAction())) ?? self::fail('not recorded: ' . $action);
    }

    /** @return array{User, Organisation} */
    private function enterprise(string $address, string $name): array
    {
        [$owner, $organisation] = $this->organisation($address, $name);
        $this->moveTo($organisation, Plan::Enterprise);

        return [$owner, $organisation];
    }

    /** @return array{User, Organisation} */
    private function organisation(string $address, string $name): array
    {
        $owner = $this->member($address, 'Owner of ' . $name);
        $organisation = self::service(OrganisationFounder::class)->found($owner, $name, 'NG', 'Africa/Lagos');
        self::service(EntityManagerInterface::class)->flush();

        return [$owner, $organisation];
    }

    private function moveTo(Organisation $organisation, Plan $plan): void
    {
        $organisation = self::service(EntityManagerInterface::class)->find(Organisation::class, $organisation->getId()) ?? self::fail('gone');
        self::service(PlanChanger::class)->change($organisation, $plan, 'Ada at Soirely', 'A test needs it.');
        self::service(EntityManagerInterface::class)->flush();
    }

    private function member(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function join(Organisation $organisation, User $user, SeededRole $as): void
    {
        $entityManager = self::service(EntityManagerInterface::class);
        $organisation = $entityManager->find(Organisation::class, $organisation->getId()) ?? self::fail('gone');
        $user = $entityManager->find(User::class, $user->getId()) ?? self::fail('gone');
        $role = Type\instance_of(Role::class)->coerce($entityManager->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $as]));
        self::service(MembershipMachine::class)->join($organisation, $user, $role, MembershipStatus::Active, MembershipChannel::Invitation, $user);
        $entityManager->flush();
    }

    private function path(Organisation $organisation, string $tail = ''): string
    {
        return Str\format('/api/orgs/%s/audit-log', $organisation->getId()->toRfc4122()) . ('' === $tail ? '' : '/' . $tail);
    }

    private function signIn(User $user): void
    {
        self::service(EntityManagerInterface::class)->flush();
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user));
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function send(string $method, string $uri, ?array $body = null): array
    {
        $this->client->request($method, $uri, server: ['CONTENT_TYPE' => 'application/json'], content: null === $body ? null : Json\encode($body));
        $content = (string) $this->client->getResponse()->getContent();

        return '' === $content ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($content));
    }
}
