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
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
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
        'guests' => ['id', 'event_id', 'host_id', 'full_name', 'email', 'mobile', 'reply', 'replied_at', 'created_at'],
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
            'mobile' => '+2348031234567',
            'companions' => [['fullName' => 'Tunde Adéwálé']],
        ]);
        self::assertSame(201, $this->statusCode());

        $files = $this->archive();

        self::assertSame(['archive.json', ...Vec\map(Vec\keys(self::TABLES), static fn (string $table): string => $table . '.csv')], Vec\keys($files));
        $json = Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($files['archive.json']));
        $tables = Vec\map(Vec\keys(self::TABLES), static fn (string $table): array => Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($json[$table]));
        [$organisation, $domains, $members, $invitations, $requests, $events, $people, $guests] = $tables;

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

        self::assertStringContainsString('Bísí Adéwálé,bisi@example.com,+2348031234567', $files['guests.csv']);
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
        self::assertSame('61', $this->client->getResponse()->headers->get('Retry-After'));
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
        self::assertEmpty(self::getMailerMessages());

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
