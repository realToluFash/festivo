<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\NeedKind;
use App\Enum\Permission;
use App\Tests\ApiTestCase;
use App\Tests\Double\ScriptedPdfMaker;
use App\Tests\Double\WithholdingMembershipDirectory;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\File;
use Psl\Filesystem;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Shell;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

/** Final numbers due, its You milestone, and the copies given to the kitchen (sc-30812). */
final class FinalNumbersTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string TITLE = 'Give final numbers to the kitchen';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    private MenuCourse $main;

    private MenuDish $jollof;

    private MenuDish $egusi;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-10-03T09:00:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live();
        $event = self::em()->find(Event::class, Uuid::fromString($this->eventId)) ?? self::fail('no event');
        $this->main = new MenuCourse($event, 'Main', null, 0);
        $this->jollof = new MenuDish($this->main, null, 'Jollof rice', null, ['celery'], [], 0);
        $this->egusi = new MenuDish($this->main, null, 'Pounded yam and egusi', null, ['milk'], [], 1);

        foreach ([$this->main, $this->jollof, $this->egusi] as $row) {
            self::em()->persist($row);
        }

        self::em()->flush();
        self::service(ScriptedPdfMaker::class)->answer('%PDF-1.7');
    }

    #[Test]
    public function aDateOnOrAfterTheStartOrNewlyInThePastIsRefusedAndNothingIsSaved(): void
    {
        $this->due('2026-10-10');

        foreach (['2030-11-14' => 'The date cannot be on or after the day the event starts. Choose an earlier date.', '2030-12-01' => 'The date cannot be on or after the day the event starts. Choose an earlier date.', '2026-10-02' => 'The date cannot be in the past. Choose today or a later date.', '3 Oct' => 'Choose a valid date.'] as $typed => $message) {
            $this->as('PUT', $this->duePath(), ['due' => $typed]);
            self::assertSame(422, $this->statusCode(), $typed);
            self::assertSame([['propertyPath' => 'due', 'message' => $message]], Vec\map(Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []), static fn (array $one): array => ['propertyPath' => $one['propertyPath'], 'message' => $one['message']]), $typed);
            self::assertSame('2026-10-10', $this->final()['due'], $typed);
        }

        $this->due('2030-11-13');
        $this->due('2026-10-03');
    }

    #[Test]
    public function todayIsTheEventsTodayWhateverTheHostsZone(): void
    {
        self::mockTime(new DateTimeImmutable('2026-10-03T23:30:00+00:00'));

        $this->as('PUT', $this->duePath(), ['due' => '2026-10-03']);
        self::assertSame(422, $this->statusCode(), 'already the 4th in Lagos');
        $this->due('2026-10-04');

        self::assertSame('2026-10-04T23:59:00+01:00', $this->milestone()['at'] ?? null, '23:59 that day in the event’s zone');
    }

    #[Test]
    public function aPassedDateStaysEditableAndMovingTheEventNeverChangesIt(): void
    {
        $this->due('2026-10-10');
        self::mockTime(new DateTimeImmutable('2026-10-12T09:00:00+00:00'));

        self::assertSame('2026-10-10', $this->final()['due']);
        $this->due('2026-10-10');
        $this->as('PUT', $this->duePath(), ['due' => '2026-10-11']);
        self::assertSame(422, $this->statusCode());
        $this->due('2026-10-12');

        $this->as('GET', '/api/events/' . $this->eventId);
        $tag = (string) $this->client->getResponse()->headers->get('ETag');
        $this->as('PATCH', '/api/events/' . $this->eventId, ['startsAt' => '2026-10-12T16:00', 'endsAt' => '2026-10-12T23:00'], headers: ['HTTP_IF_MATCH' => $tag]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame('2026-10-12', $this->final()['due'], 'shown as set, on the event’s first day');

        $this->due(null);
        self::assertNull($this->final()['due']);
    }

    #[Test]
    public function theMilestoneIsTheHostsAtTheDueDayAndMovesClearsAndGoes(): void
    {
        self::assertNull($this->milestone());

        $this->due('2026-10-10');
        self::assertSame([
            'at' => '2026-10-10T23:59:00+01:00',
            'title' => self::TITLE,
            'note' => null,
            'owner' => 'you',
            'area' => 'menu',
            'action' => ['label' => 'Open the kitchen sheet', 'link' => '/app/events/' . $this->eventId . '/menu/kitchen'],
            'done' => false,
        ], $this->milestone());

        $this->due('2026-10-20');
        self::assertSame('2026-10-20T23:59:00+01:00', $this->milestone()['at'] ?? null, 'moved');

        self::mockTime(new DateTimeImmutable('2026-10-25T09:00:00+00:00'));
        self::assertSame([false, '2026-10-20T23:59:00+01:00'], [$this->milestone()['done'] ?? null, $this->milestone()['at'] ?? null], 'overdue: still there, not done');

        $this->due(null);
        self::assertNull($this->milestone(), 'cleared');

        $this->due('2026-10-26');
        $this->give();
        self::assertNull($this->milestone(), 'gone with a copy');
    }

    #[Test]
    public function aCopyGivenBeforeTheDateIsSetMeansNoMilestone(): void
    {
        $this->give();
        $this->due('2026-10-10');

        self::assertNull($this->milestone());
    }

    #[Test]
    public function theMilestoneIsGoneAtTheStart(): void
    {
        $this->due('2030-11-13');
        self::assertNotNull($this->milestone());

        self::mockTime(new DateTimeImmutable('2030-11-14T15:00:00+00:00'));
        self::assertNull($this->milestone());
    }

    #[Test]
    public function theMilestoneIsGoneOnACalledOffEvent(): void
    {
        $this->due('2026-10-10');
        $this->as('POST', '/api/events/' . $this->eventId . '/end');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertNull($this->milestone());
    }

    #[Test]
    public function aSubscribedCalendarMovesTheEntryAndDropsItOnACopy(): void
    {
        $this->as('GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/calendar-feed');
        $path = Type\shape(['path' => Type\string()], true)->coerce($this->last())['path'];
        $uid = 'UID:milestone-' . $this->eventId . '-menu.final_numbers@soirely';

        $this->due('2026-10-10');
        [$first] = self::entries($this->feed($path), $uid);
        self::assertStringContainsString('DTSTART;TZID=Africa/Lagos:20261010T235900', $first);

        $this->due('2026-10-20');
        $moved = self::entries($this->feed($path), $uid);
        self::assertCount(1, $moved, 'one entry, never a second');
        self::assertStringContainsString('DTSTART;TZID=Africa/Lagos:20261020T235900', $moved[0]);
        self::assertGreaterThan(self::sequence($first), self::sequence($moved[0]), 'the calendar takes the moved entry');

        $this->give();
        self::assertSame([], self::entries($this->feed($path), $uid));
    }

    #[Test]
    public function onlyMenuManageSetsTheDateOrGivesAndMenuReadSeesBoth(): void
    {
        $this->due('2026-10-10');
        $this->give();
        $copy = $this->copyIds()[0];
        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::MenuManage);

        $this->as('PUT', $this->duePath(), ['due' => '2026-10-11']);
        self::assertSame(403, $this->statusCode());
        $this->as('POST', $this->sheetPath() . '/copies');
        self::assertSame(403, $this->statusCode());
        $final = $this->final();
        self::assertSame(['2026-10-10', 1], [$final['due'], Iter\count(Type\vec(Type\mixed())->coerce($final['copies']))]);
        $this->as('POST', $this->copyPath($copy));
        self::assertSame(200, $this->statusCode());

        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::MenuRead);
        $this->as('GET', $this->sheetPath());
        self::assertSame(403, $this->statusCode());
        $this->as('POST', $this->copyPath($copy));
        self::assertSame(403, $this->statusCode());
    }

    #[Test]
    public function withoutMenuReadTheMilestoneIsNotOnTheTimeline(): void
    {
        $this->due('2026-10-10');
        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::MenuRead);

        self::assertNull($this->milestone());
    }

    #[Test]
    public function giveMakesThePdfAsDownloadPdfDoesAndRecordsItWhileDownloadPdfRecordsNothing(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->records($this->personId('Chidi Okonkwo'), ['celery']);
        self::mockTime(new DateTimeImmutable('2026-10-03T16:00:00+00:00'));

        $this->as('POST', $this->sheetPath() . '/pdf');
        self::assertSame(200, $this->statusCode());
        $plain = self::service(ScriptedPdfMaker::class)->html;
        self::assertSame([], $this->final()['copies'], 'Download PDF records nothing');

        $this->as('POST', $this->sheetPath() . '/copies');
        self::assertSame(200, $this->statusCode(), (string) $this->client->getResponse()->getContent());
        self::assertSame(['%PDF-1.7', 'application/pdf'], [$this->client->getResponse()->getContent(), $this->client->getResponse()->headers->get('Content-Type')]);
        self::assertSame($plain, self::service(ScriptedPdfMaker::class)->html, 'the PDF exactly as Download PDF makes it');

        $copies = Type\vec(Type\shape(['id' => Type\string(), 'recordedAt' => Type\string(), 'by' => Type\string()]))->coerce($this->final()['copies']);
        self::assertSame([['2026-10-03T17:00:00+01:00', 'Person']], Vec\map($copies, static fn (array $copy): array => [$copy['recordedAt'], $copy['by']]));
    }

    #[Test]
    public function aPdfThatCannotBeMadeRecordsNothing(): void
    {
        self::service(ScriptedPdfMaker::class)->takeDown();

        $this->as('POST', $this->sheetPath() . '/copies');

        self::assertSame(503, $this->statusCode());
        self::assertSame([], $this->final()['copies']);
    }

    #[Test]
    public function aCopyHoldsItsFiguresAsGivenInTheReadersLanguage(): void
    {
        $token = $this->coming([]);
        $bisi = $this->personId('Bisi Adewale');
        $this->meals($token, [['person' => $bisi, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->jollof)]]);
        self::mockTime(new DateTimeImmutable('2026-10-04T08:30:00+00:00'));
        $this->give();
        $copy = $this->copyIds()[0];
        $given = $this->copyHtml($copy);

        self::mockTime(new DateTimeImmutable('2026-10-06T08:30:00+00:00'));
        $this->meals($token, [['person' => $bisi, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->egusi)]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame($given, $this->copyHtml($copy), 'unchanged after the pick changed');
        self::assertStringContainsString('<th scope="row">Jollof rice</th><td class="n">1</td>', $given);
        self::assertStringContainsString('09:30', $given, 'As of the moment it was given, in Lagos');
        self::assertStringContainsString("filename*=utf-8''" . \rawurlencode("Amara & Tobi's wedding kitchen sheet 2026-10-04.pdf"), (string) $this->client->getResponse()->headers->get('Content-Disposition'));
        self::assertStringContainsString('<html lang="es">', $this->copyHtml($copy, 'es'));

        $this->as('POST', $this->copyPath(Uuid::v7()->toRfc4122()));
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function namesReachACopysReaderOnlyWhenTheRecorderAndTheReaderBothHoldGuestsManage(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->records($this->personId('Chidi Okonkwo'), ['celery']);
        $directory = self::service(WithholdingMembershipDirectory::class);

        self::mockTime(new DateTimeImmutable('2026-10-03T10:00:00+00:00'));
        $this->give();
        $directory->withhold(Permission::GuestsManage);
        self::mockTime(new DateTimeImmutable('2026-10-03T11:00:00+00:00'));
        $this->give();
        $directory->restore();
        [$with, $without] = $this->copyIds();

        foreach ([[$with, true, true], [$with, false, false], [$without, true, false], [$without, false, false]] as [$copy, $reader, $named]) {
            $directory->restore();
            if (!$reader) {
                $directory->withhold(Permission::GuestsManage);
            }

            $html = $this->copyHtml($copy);
            $case = ($copy === $with ? 'recorder with' : 'recorder without') . ', reader ' . ($reader ? 'with' : 'without');
            self::assertSame($named, Str\contains($html, 'Chidi Okonkwo'), $case);
            self::assertSame(!$named, Str\contains($html, 'Names need Guests manage.'), $case);
        }
    }

    #[Test]
    public function anErasedGuestLeavesEveryCopyAndTheCountsStay(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->records($this->personId('Chidi Okonkwo'), ['celery']);
        $this->give();
        $copy = $this->copyIds()[0];
        $bisi = $this->personId('Bisi Adewale');

        $this->as('DELETE', '/api/events/' . $this->eventId . '/guests/' . $bisi);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        $this->as('POST', '/api/events/' . $this->eventId . '/guests/' . $bisi . '/erasure');
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));

        $html = $this->copyHtml($copy);
        self::assertStringNotContainsString('Chidi', $html);
        self::assertStringNotContainsString('Chidi', Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT sheet::text FROM kitchen_copies WHERE id = :id', ['id' => $copy])));
        self::assertStringContainsString('2 coming', $html, 'the counts stay as given');
    }

    #[Test]
    public function aCopysEventGoesWithItsCopies(): void
    {
        $this->give();

        self::service(Connection::class)->executeStatement('DELETE FROM events WHERE id = :id', ['id' => $this->eventId]);

        self::assertSame(0, Type\int()->coerce(self::service(Connection::class)->fetchOne('SELECT COUNT(*) FROM kitchen_copies')));
    }

    /** The real WeasyPrint, and veraPDF's PDF/UA-1 profile (ISO 14289-1), on a copy's PDF. */
    #[Test]
    public function aCopysPdfPassesVeraPdfsPdfUa1Profile(): void
    {
        self::service(ScriptedPdfMaker::class)->real();
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->records($this->personId('Chidi Okonkwo'), ['celery']);
        $this->give();

        $this->as('POST', $this->copyPath($this->copyIds()[0]));
        self::assertSame(200, $this->statusCode(), (string) $this->client->getResponse()->getContent());
        $file = Filesystem\create_temporary_file(null, 'kitchen') . '.pdf';
        File\write($file, (string) $this->client->getResponse()->getContent());

        try {
            $report = Shell\execute('verapdf', ['--flavour', 'ua1', '--format', 'xml', $file]);
        } catch (Shell\Exception\FailedExecutionException $failed) {
            $report = $failed->getOutput();
        } finally {
            Filesystem\delete_file($file);
        }

        self::assertStringContainsString('isCompliant="true"', $report, $report);
    }

    private function due(?string $day): void
    {
        $this->as('PUT', $this->duePath(), ['due' => $day]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function give(): void
    {
        $this->as('POST', $this->sheetPath() . '/copies');
        self::assertSame(200, $this->statusCode(), (string) $this->client->getResponse()->getContent());
    }

    private function copyHtml(string $copy, string $language = 'en'): string
    {
        $this->as('POST', $this->copyPath($copy), language: $language);
        self::assertSame(200, $this->statusCode(), (string) $this->client->getResponse()->getContent());

        return self::service(ScriptedPdfMaker::class)->html ?? self::fail('no html');
    }

    /** @return list<string> oldest first */
    private function copyIds(): array
    {
        return Vec\reverse(Vec\map(Type\vec(Type\shape(['id' => Type\string()], true))->coerce($this->final()['copies']), static fn (array $copy): string => $copy['id']));
    }

    /** @return array<string, mixed> */
    private function final(): array
    {
        $this->as('GET', $this->sheetPath());
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return Type\shape(['finalNumbers' => Type\dict(Type\string(), Type\mixed())], true)->coerce($this->last())['finalNumbers'];
    }

    /** @return array<string, mixed>|null */
    private function milestone(): ?array
    {
        $this->as('GET', '/api/events/' . $this->eventId . '/timeline');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $milestones = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->last()['milestones'] ?? null);

        return Iter\search($milestones, static fn (array $one): bool => self::TITLE === ($one['title'] ?? null));
    }

    private function feed(string $path): string
    {
        $this->client->request('GET', $path);
        self::assertSame(200, $this->statusCode());

        return Str\replace((string) $this->client->getResponse()->getContent(), "\r\n ", '');
    }

    /** @return list<string> */
    private static function entries(string $calendar, string $uid): array
    {
        return Vec\filter(Str\split($calendar, 'BEGIN:VEVENT'), static fn (string $entry): bool => Str\contains($entry, $uid . "\r\n"));
    }

    private static function sequence(string $entry): int
    {
        return Type\int()->coerce(Regex\first_match($entry, '/SEQUENCE:(\d+)/', Regex\capture_groups([1]))[1] ?? self::fail('no sequence'));
    }

    private function duePath(): string
    {
        return '/api/events/' . $this->eventId . '/menu/final-numbers';
    }

    private function sheetPath(): string
    {
        return '/api/events/' . $this->eventId . '/menu/kitchen-sheet';
    }

    private function copyPath(string $copy): string
    {
        return $this->sheetPath() . '/copies/' . $copy . '/pdf';
    }

    private function id(MenuCourse|MenuDish $row): string
    {
        return $row->getId()->toRfc4122();
    }

    /** @param list<array{fullName: ?string}> $companions */
    private function coming(array $companions): string
    {
        $this->as('POST', '/api/events/' . $this->eventId . '/guests', ['fullName' => 'Bisi Adewale', 'companions' => Vec\map($companions, static fn (array $one): array => ['fullName' => $one['fullName']])]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $guestId = Type\shape(['id' => Type\string()], true)->coerce($this->last()['guest'] ?? null)['id'];
        $this->as('GET', '/api/events/' . $this->eventId . '/guests/' . $guestId . '/link');
        $token = Str\after(Type\string()->coerce($this->last()['url'] ?? null), '/i/') ?? self::fail('no token');
        $this->anonymous('/api/guest-links/page', ['token' => $token]);
        $listed = Type\vec(Type\shape(['id' => Type\string()], true))->coerce(Type\mixed_dict()->coerce($this->last()['guest'] ?? null)['companions'] ?? []);
        $this->anonymous('/api/guest-links/reply', [
            'token' => $token,
            'answer' => 'coming',
            'needs' => ['allergies' => []],
            'companions' => Vec\map_with_key($listed, static fn (int $at, array $companion): array => ['id' => $companion['id'], 'fullName' => $companions[$at]['fullName'], 'coming' => true]),
        ]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $token;
    }

    private function personId(string $name): string
    {
        return Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT id FROM guests WHERE full_name = :name', ['name' => $name]));
    }

    /** @param list<string> $allergies */
    private function records(string $guestId, array $allergies): void
    {
        $person = self::em()->find(Guest::class, Uuid::fromString($guestId)) ?? self::fail('no guest');
        $none = GuestNeeds::none();
        $needs = new GuestNeeds([...$none->codes, NeedKind::Allergen->value => $allergies], $none->others, null);
        self::service(GuestNeedsRecord::class)->write($person, $needs, $this->owner);
        self::em()->flush();
    }

    /** @param list<array<string, mixed>> $picks */
    private function meals(#[SensitiveParameter] string $token, array $picks): void
    {
        $this->anonymous('/api/guest-links/meals', ['token' => $token, 'picks' => $picks]);
    }

    /** @param array<string, mixed> $body */
    private function anonymous(string $path, #[SensitiveParameter] array $body): void
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode($body));
    }

    private function live(): string
    {
        $this->as('POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => "Amara & Tobi's wedding", 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $id = Type\shape(['id' => Type\string()], true)->coerce($this->last()['event'] ?? null)['id'];
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as('POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     * @param array<string, string>     $headers
     */
    private function as(string $method, string $path, ?array $body = null, string $language = 'en', array $headers = []): void
    {
        $who = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => $language,
            ...$headers,
        ], content: null === $body ? null : Json\encode($body));
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw || !Str\starts_with($raw, '{') ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
