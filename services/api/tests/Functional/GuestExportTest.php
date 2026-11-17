<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\Export\GuestExporter;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\WithholdingMembershipDirectory;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use DateTimeZone;
use DOMDocument;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\File;
use Psl\Filesystem;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use ZipArchive;

/** Export: the list the host is looking at, as a spreadsheet, with only what they may see (sc-3784). */
final class GuestExportTest extends ApiTestCase
{
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const array HEADINGS = ['Full name', 'Guest of', 'Group', 'Reply', 'Replied on', 'Email', 'Mobile number', 'Allergies', 'Diet', 'Access', 'Places', 'Added on'];

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
    }

    #[Test]
    public function anExcelFileHasEveryoneSentInTheirOrderEachCompanionAfterTheirGuestWithTheirDetailsInWords(): void
    {
        $bisi = $this->add([
            'fullName' => 'Bísí Adéwálé',
            'email' => 'bisi@example.com',
            'group' => ['name' => 'Family'],
            'needs' => ['allergies' => ['peanuts', 'other'], 'otherAllergy' => 'Kiwi', 'diet' => ['halal']],
            'companions' => [['fullName' => 'Tunde', 'needs' => ['access' => ['step_free']]], ['fullName' => null]],
        ]);
        $zoe = $this->add(['fullName' => 'Zoë Martin']);
        [$tunde, $unnamed] = $this->companionIds($bisi);

        $rows = $this->xlsx($this->export('xlsx', [$this->id($bisi), $tunde, $unnamed, $this->id($zoe)]));

        self::assertSame(200, $this->statusCode());
        $added = $this->today();
        self::assertSame([
            self::HEADINGS,
            ['Bísí Adéwálé', '', 'Family', 'Not yet invited', '', 'bisi@example.com', '', 'Peanuts, Kiwi', 'Halal', '', '3', $added],
            ['Tunde', 'Bísí Adéwálé', 'Family', 'Not yet invited', '', '', '', '', '', 'Step-free access', '', $added],
            ['', 'Bísí Adéwálé', 'Family', 'Not yet invited', '', '', '', '', '', '', '', $added],
            ['Zoë Martin', '', '', 'Not yet invited', '', '', '', '', '', '', '1', $added],
        ], $rows);
        self::assertSame('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', $this->client->getResponse()->headers->get('Content-Type'));
        self::assertStringContainsString("filename*=utf-8''Owambe%20%E2%80%93%20guests%20%E2%80%93%20" . $this->today() . '.xlsx', (string) $this->client->getResponse()->headers->get('Content-Disposition'));
    }

    #[Test]
    public function thisViewIsOnlyThePeopleSentAndSomeoneNoLongerOnTheListIsLeftOut(): void
    {
        $bisi = $this->add(['fullName' => 'Bisi', 'companions' => [['fullName' => 'Tunde']]]);
        $zoe = $this->add(['fullName' => 'Zoe']);

        $rows = $this->csv($this->export('csv', [$this->id($zoe), $this->companionIds($bisi)[0], '0193f0a2-0000-7000-8000-000000000000', $this->id($zoe)], 'view'));

        self::assertSame(['Zoe', 'Tunde'], Vec\map(Vec\drop($rows, 1), static fn (array $row): string => $row[0]));
    }

    #[Test]
    public function aCsvFileOpensWithItsAccentsIntactBehindAByteOrderMark(): void
    {
        $guest = $this->add(['fullName' => 'Ọlá Ẹ̀kọ́ "Junior", Zoë']);

        $raw = $this->export('csv', [$this->id($guest)]);

        self::assertSame('text/csv; charset=UTF-8', $this->client->getResponse()->headers->get('Content-Type'));
        self::assertTrue(Str\starts_with($raw, "\u{FEFF}"));
        self::assertSame(['Ọlá Ẹ̀kọ́ "Junior", Zoë', ''], Vec\take($this->csv($raw)[1], 2));
    }

    /** @return iterable<string, array{string}> */
    public static function formulaStarts(): iterable
    {
        foreach (['=' => 'equals', '+' => 'plus', '-' => 'minus', '@' => 'at'] as $start => $name) {
            yield $name => [$start];
        }
    }

    #[Test]
    #[DataProvider('formulaStarts')]
    public function aCellThatWouldBeReadAsAFormulaIsWrittenAsText(string $start): void
    {
        $guest = $this->add(['fullName' => 'Bisi', 'group' => ['name' => $start . 'HYPERLINK("http://x")']]);

        self::assertSame("'" . $start . 'HYPERLINK("http://x")', $this->csv($this->export('csv', [$this->id($guest)]))[1][2]);
        self::assertSame("'" . $start . 'HYPERLINK("http://x")', $this->xlsx($this->export('xlsx', [$this->id($guest)]))[1][2]);
    }

    #[Test]
    public function withoutGuestsManageTheNeedsColumnsAreNotInTheFile(): void
    {
        $guest = $this->add(['fullName' => 'Bisi', 'email' => 'bisi@example.com', 'needs' => ['allergies' => ['milk']]]);
        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::GuestsManage);

        $rows = $this->csv($this->export('csv', [$this->id($guest)]));

        self::assertSame(200, $this->statusCode());
        self::assertSame(['Full name', 'Guest of', 'Group', 'Reply', 'Replied on', 'Email', 'Mobile number', 'Places', 'Added on'], $rows[0]);
        self::assertSame(['Bisi', '', '', 'Not yet invited', '', 'bisi@example.com', '', '1', $this->today()], $rows[1]);
        self::assertSame(false, $this->audited()['needs'][1]);
    }

    #[Test]
    public function canEditTheEventExportsAsAMemberDoesWithTheNeeds(): void
    {
        $guest = $this->add(['fullName' => 'Bisi', 'needs' => ['diet' => ['vegan']]]);
        $editor = $this->member('editor@ire.events', EventRole::CanEdit);

        $rows = $this->csv($this->export('csv', [$this->id($guest)], by: $editor));

        self::assertSame(200, $this->statusCode());
        self::assertSame('Vegan', $rows[1][8]);
    }

    /** @return iterable<string, array{EventRole}> */
    public static function noExport(): iterable
    {
        yield 'Can view' => [EventRole::CanView];
        yield 'Can check guests in' => [EventRole::CanCheckIn];
    }

    #[Test]
    #[DataProvider('noExport')]
    public function aGrantThatOnlyLooksOrChecksPeopleInIsRefused(EventRole $role): void
    {
        $guest = $this->add(['fullName' => 'Bisi']);
        $holder = $this->member('holder@ire.events', $role);

        $this->export('csv', [$this->id($guest)], by: $holder);

        self::assertSame(403, $this->statusCode());
        self::assertStringNotContainsString('Bisi', (string) $this->client->getResponse()->getContent());
        self::assertSame([], self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestExporter::EXPORTED]));
    }

    #[Test]
    public function everyExportIsAuditedWithWhoHowManyRowsAndWhetherItHadNeedsAndContacts(): void
    {
        $guest = $this->add(['fullName' => 'Bisi', 'companions' => [['fullName' => 'Tunde']]]);

        $this->export('xlsx', [$this->id($guest), ...$this->companionIds($guest)], 'all');

        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestExporter::EXPORTED]);
        self::assertCount(1, $entries);
        self::assertSame($this->owner->getId()->toRfc4122(), $entries[0]->getActorId()?->toRfc4122());
        self::assertSame($this->eventId, $entries[0]->getSubjectId()->toRfc4122());
        self::assertSame(['rows' => [null, 2], 'scope' => [null, 'all'], 'format' => [null, 'xlsx'], 'needs' => [null, true], 'contacts' => [null, true]], $entries[0]->getChanges());
    }

    #[Test]
    public function aFormatOrScopeNotOfferedIsRefused(): void
    {
        $this->as($this->owner, 'POST', $this->guests() . '/export', ['format' => 'pdf', 'scope' => 'view', 'people' => []]);
        self::assertSame(422, $this->statusCode());

        $this->as($this->owner, 'POST', $this->guests() . '/export', ['format' => 'csv', 'scope' => 'some', 'people' => []]);
        self::assertSame(422, $this->statusCode());
    }

    #[Test]
    public function tenThousandPeopleAreBuiltInUnderFiveSeconds(): void
    {
        $connection = self::em()->getConnection();
        $ids = [];
        for ($at = 0; $at < 10_000; ++$at) {
            $id = Str\format('0193f0a2-%04x-7000-8000-%012x', $at % 0xFFFF, $at);
            $ids[] = $id;
            $connection->insert('guests', [
                'id' => $id,
                'event_id' => $this->eventId,
                'full_name' => 'Guest ' . $at,
                'name_key' => 'guest ' . $at,
                'email' => 'guest' . $at . '@example.com',
                'position' => $at,
                'link_token' => Str\format('export-test-link-%05d', $at),
                'created_at' => '2026-11-01 10:00:00',
                'updated_at' => '2026-11-01 10:00:00',
            ]);
        }

        $started = \microtime(true);
        $rows = $this->xlsx($this->export('xlsx', $ids, 'all'));
        $took = \microtime(true) - $started;

        self::assertSame(200, $this->statusCode());
        self::assertCount(10_001, $rows);
        self::assertLessThan(5.0, $took);
    }

    private function today(): string
    {
        return self::service(ClockInterface::class)->now()->setTimezone(new DateTimeZone('Africa/Lagos'))->format('Y-m-d');
    }

    /** @return array<string, array{0: mixed, 1: mixed}> */
    private function audited(): array
    {
        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestExporter::EXPORTED]);

        return $entries[0]->getChanges();
    }

    /** @param list<string> $people */
    private function export(string $format, array $people, string $scope = 'view', ?User $by = null): string
    {
        $this->as($by ?? $this->owner, 'POST', $this->guests() . '/export', ['format' => $format, 'scope' => $scope, 'people' => $people]);

        return (string) $this->client->getResponse()->getContent();
    }

    /** @return list<list<string>> */
    private function csv(string $raw): array
    {
        $rows = [];
        $stream = \fopen('php://temp', 'r+') ?: self::fail('no stream');
        \fwrite($stream, Str\strip_prefix($raw, "\u{FEFF}"));
        \rewind($stream);
        while (false !== ($row = \fgetcsv($stream, null, ',', '"', ''))) {
            $rows[] = Vec\map($row, static fn (?string $cell): string => $cell ?? '');
        }
        \fclose($stream);

        return $rows;
    }

    /** @return list<list<string>> each row's cells, as Excel would read them */
    private function xlsx(string $raw): array
    {
        $path = Filesystem\create_temporary_file();
        File\write($path, $raw, File\WriteMode::Truncate);
        $zip = new ZipArchive();
        self::assertTrue($zip->open($path));
        $sheet = $zip->getFromName('xl/worksheets/sheet1.xml');
        self::assertNotFalse($zip->getFromName('xl/workbook.xml'));
        $zip->close();
        Filesystem\delete_file($path);
        self::assertIsString($sheet);

        $document = new DOMDocument();
        self::assertTrue($document->loadXML($sheet));
        $rows = [];
        foreach ($document->getElementsByTagName('row') as $row) {
            $cells = [];
            foreach ($row->getElementsByTagName('c') as $cell) {
                $cells[] = $cell->textContent;
            }
            $rows[] = $cells;
        }

        return $rows;
    }

    /** @param array<string, mixed> $guest */
    private function id(array $guest): string
    {
        return Type\string()->coerce($guest['id'] ?? null);
    }

    private function guests(): string
    {
        return '/api/events/' . $this->eventId . '/guests';
    }

    /** @return list<string> */
    private function companionIds(mixed $guest): array
    {
        $companions = Type\shape(['companions' => Type\vec(Type\shape(['id' => Type\string()], true))], true)->coerce($guest)['companions'];

        return Vec\map($companions, static fn (array $one): string => $one['id']);
    }

    /** @return array<string, mixed> */
    private function add(mixed $guest): array
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), Type\dict(Type\string(), Type\mixed())->coerce($guest));
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\dict(Type\string(), Type\mixed())->coerce($body['guest'] ?? null);
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2026-11-14T16:00',
            'endsAt' => '2026-11-15T02:00',
        ]);
        self::assertSame(201, $this->statusCode());

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, EventRole $on): User
    {
        $user = $this->account($address);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Member]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();
        self::onEvent($user, $this->eventId, $on);

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ], content: null === $body ? null : Json\encode($body));

        $raw = (string) $this->client->getResponse()->getContent();
        $type = (string) $this->client->getResponse()->headers->get('Content-Type');

        return '' === $raw || !Str\contains($type, 'json') ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
