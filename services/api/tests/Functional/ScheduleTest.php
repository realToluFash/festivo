<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\RunOfShow\ScheduleEditor;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Event;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\ScheduleItem;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use DateTimeZone;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

final class ScheduleTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-01T10:00:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent('2027-03-06T16:00', '2027-03-07T02:00', 'Africa/Lagos');
    }

    #[Test]
    public function anEventWithNoItemsHasAnEmptyScheduleAndItsWindow(): void
    {
        $schedule = $this->schedule();

        self::assertSame(200, $this->statusCode());
        self::assertSame([], $schedule['items']);
        self::assertSame('Africa/Lagos', $schedule['timeZone']);
        self::assertSame('2027-03-06T04:00:00+01:00', $schedule['earliest']);
        self::assertSame('2027-03-07T02:00:00+01:00', $schedule['latest']);
        self::assertSame(200, $schedule['itemsMaximum']);
    }

    #[Test]
    public function anItemKeepsItsStartLengthPlaceAndOwner(): void
    {
        $item = $this->add([
            'title' => '  First dance ',
            'startsAt' => '2027-03-06T20:15',
            'lengthMinutes' => 10,
            'place' => 'Ballroom',
            'ownerName' => 'Tunde Adebayo',
            'ownerRole' => 'MC',
            'note' => 'Cue the band.',
            'fixedTime' => true,
            'showToGuests' => true,
        ]);

        self::assertSame(201, $this->statusCode());
        self::assertSame([
            'title' => 'First dance',
            'startsAt' => '2027-03-06T20:15:00+01:00',
            'day' => '2027-03-06',
            'lengthMinutes' => 10,
            'place' => 'Ballroom',
            'ownerName' => 'Tunde Adebayo',
            'ownerRole' => 'MC',
            'note' => 'Cue the band.',
            'fixedTime' => true,
            'showToGuests' => true,
            'version' => 1,
        ], Dict\filter_keys($item, static fn (string $key): bool => 'id' !== $key));
    }

    #[Test]
    public function blankOptionalFieldsAreKeptAsNone(): void
    {
        $item = $this->add(['title' => 'Doors', 'startsAt' => '2027-03-06T16:00', 'place' => ' ', 'ownerName' => '', 'note' => null]);

        self::assertNull($item['place']);
        self::assertNull($item['ownerName']);
        self::assertNull($item['note']);
        self::assertNull($item['lengthMinutes']);
        self::assertFalse($item['fixedTime']);
        self::assertFalse($item['showToGuests']);
    }

    /** @return iterable<string, array{array<string, mixed>, string, string}> */
    public static function refused(): iterable
    {
        yield 'a blank title' => [['title' => '  '], 'title', 'Enter a title.'];
        yield 'a title over 120' => [['title' => Str\repeat('a', 121)], 'title', 'That title is 121 characters. Use 120 or fewer.'];
        yield 'no start' => [['startsAt' => null], 'startsAt', 'Choose the date and time it starts.'];
        yield 'a start that is not a time' => [['startsAt' => '2027-03-06T25:00'], 'startsAt', 'Choose the date and time it starts.'];
        yield 'a start before set-up' => [['startsAt' => '2027-03-06T03:59'], 'startsAt', 'Choose a time between Sat 6 Mar, 04:00 and Sun 7 Mar, 02:00.'];
        yield 'a start after the end' => [['startsAt' => '2027-03-07T02:01'], 'startsAt', 'Choose a time between Sat 6 Mar, 04:00 and Sun 7 Mar, 02:00.'];
        yield 'a length over 720' => [['lengthMinutes' => 721], 'lengthMinutes', 'Enter a length from 0 to 720 minutes, or leave it empty.'];
        yield 'a negative length' => [['lengthMinutes' => -1], 'lengthMinutes', 'Enter a length from 0 to 720 minutes, or leave it empty.'];
        yield 'an owner over 120' => [['ownerName' => Str\repeat('a', 121)], 'ownerName', 'That name is 121 characters. Use 120 or fewer.'];
        yield 'a role over 40' => [['ownerRole' => Str\repeat('a', 41)], 'ownerRole', 'That role is 41 characters. Use 40 or fewer.'];
        yield 'a note over 500' => [['note' => Str\repeat('a', 501)], 'note', 'That note is 501 characters. Use 500 or fewer.'];
        yield 'a title over 120 marked letters' => [['title' => Str\repeat("e\u{0323}\u{0300}", 121)], 'title', 'That title is 121 characters. Use 120 or fewer.'];
        yield 'a title of one letter of many marks' => [['title' => 'a' . Str\repeat("\u{0301}", 480)], 'title', 'That title is 1 characters. Use 120 or fewer.'];
        yield 'a place over 60 marked letters' => [['place' => Str\repeat("e\u{0323}\u{0300}", 61)], 'place', 'That place is 61 characters. Use 60 or fewer.'];
        yield 'a place of one letter of many marks' => [['place' => 'a' . Str\repeat("\u{0301}", 240)], 'place', 'That place is 1 characters. Use 60 or fewer.'];
        yield 'an owner over 120 marked letters' => [['ownerName' => Str\repeat("e\u{0323}\u{0300}", 121)], 'ownerName', 'That name is 121 characters. Use 120 or fewer.'];
        yield 'an owner of one letter of many marks' => [['ownerName' => 'a' . Str\repeat("\u{0301}", 480)], 'ownerName', 'That name is 1 characters. Use 120 or fewer.'];
        yield 'a role over 40 marked letters' => [['ownerRole' => Str\repeat("e\u{0323}\u{0300}", 41)], 'ownerRole', 'That role is 41 characters. Use 40 or fewer.'];
        yield 'a role of one letter of many marks' => [['ownerRole' => 'a' . Str\repeat("\u{0301}", 160)], 'ownerRole', 'That role is 1 characters. Use 40 or fewer.'];
        yield 'a note over 500 marked letters' => [['note' => Str\repeat("e\u{0323}\u{0300}", 501)], 'note', 'That note is 501 characters. Use 500 or fewer.'];
        yield 'a note of one letter of many marks' => [['note' => 'a' . Str\repeat("\u{0301}", 2000)], 'note', 'That note is 1 characters. Use 500 or fewer.'];
    }

    /** @param array<string, mixed> $wrong */
    #[Test]
    #[DataProvider('refused')]
    public function aWrongFieldIsRefusedBesideItAndNothingIsSaved(array $wrong, string $field, string $message): void
    {
        $this->as($this->owner, 'POST', $this->items(), $wrong + ['title' => 'Speeches', 'startsAt' => '2027-03-06T19:00']);

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation($field));
        self::assertSame([], $this->schedule()['items']);
    }

    #[Test]
    public function theEdgesOfTheWindowAndTheLimitsAreKept(): void
    {
        $this->add(['title' => Str\repeat('a', 120), 'startsAt' => '2027-03-06T04:00', 'lengthMinutes' => 720, 'ownerName' => Str\repeat('b', 120), 'ownerRole' => Str\repeat('c', 40), 'note' => Str\repeat('d', 500)]);
        self::assertSame(201, $this->statusCode());

        $this->add(['title' => 'Last song', 'startsAt' => '2027-03-07T02:00', 'lengthMinutes' => 0]);
        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function eachLimitInLettersWithADotAndAToneIsReadBackAsTyped(): void
    {
        foreach (['19:00' => "\u{1EB9}\u{0300}", '20:00' => "e\u{0323}\u{0300}"] as $time => $letter) {
            $typed = ['title' => Str\repeat($letter, 120), 'place' => Str\repeat($letter, 60), 'ownerName' => Str\repeat($letter, 120), 'ownerRole' => Str\repeat($letter, 40), 'note' => Str\repeat($letter, 500)];
            $this->add([...$typed, 'startsAt' => '2027-03-06T' . $time]);
            self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        }

        foreach ($this->schedule()['items'] as $index => $item) {
            $letter = 0 === $index ? "\u{1EB9}\u{0300}" : "e\u{0323}\u{0300}";
            self::assertSame(
                [Str\repeat($letter, 120), Str\repeat($letter, 60), Str\repeat($letter, 120), Str\repeat($letter, 40), Str\repeat($letter, 500)],
                [$item['title'], $item['place'], $item['ownerName'], $item['ownerRole'], $item['note']],
            );
        }
    }

    #[Test]
    public function itemsAreSortedByStartAndEachIsOnTheEventDayOfItsStart(): void
    {
        $this->add(['title' => 'After party', 'startsAt' => '2027-03-07T00:30', 'place' => 'Garden']);
        $this->add(['title' => 'Speeches', 'startsAt' => '2027-03-06T19:00', 'place' => 'Ballroom']);
        $this->add(['title' => 'Set-up', 'startsAt' => '2027-03-06T08:00']);
        $this->add(['title' => 'Cake', 'startsAt' => '2027-03-06T22:00', 'place' => 'Ballroom']);
        $this->add(['title' => 'Last song', 'startsAt' => '2027-03-07T01:45', 'place' => 'Ballroom']);

        self::assertSame([
            ['Set-up', '2027-03-06', null],
            ['Speeches', '2027-03-06', 'Ballroom'],
            ['Cake', '2027-03-06', 'Ballroom'],
            ['After party', '2027-03-06', 'Garden'],
            ['Last song', '2027-03-06', 'Ballroom'],
        ], Vec\map($this->schedule()['items'], static fn (array $item): array => [$item['title'], $item['day'], $item['place']]));
    }

    #[Test]
    public function anItemAtFiveInTheMorningStartsTheNextEventDay(): void
    {
        $id = $this->newEvent('2027-03-12T18:00', '2027-03-14T23:00', 'Africa/Lagos');
        $this->eventId = $id;
        $this->add(['title' => 'Late bar', 'startsAt' => '2027-03-13T04:59']);
        $this->add(['title' => 'Breakfast', 'startsAt' => '2027-03-13T05:00']);

        self::assertSame([['Late bar', '2027-03-12'], ['Breakfast', '2027-03-13']], Vec\map($this->schedule()['items'], static fn (array $item): array => [$item['title'], $item['day']]));
    }

    #[Test]
    public function itemsAcrossAChangeOfClocksKeepTheirWallClockTimeAndCarryTheirOwnOffset(): void
    {
        $this->eventId = $this->newEvent('2027-03-27T18:00', '2027-03-28T04:00', 'Europe/London');
        $this->add(['title' => 'Last dance', 'startsAt' => '2027-03-28T00:30']);
        $this->add(['title' => 'Carriages', 'startsAt' => '2027-03-28T02:30']);

        self::assertSame([
            ['Last dance', '2027-03-28T00:30:00+00:00', '2027-03-27'],
            ['Carriages', '2027-03-28T02:30:00+01:00', '2027-03-27'],
        ], Vec\map($this->schedule()['items'], static fn (array $item): array => [$item['title'], $item['startsAt'], $item['day']]));
    }

    #[Test]
    public function savingTheWholeItemChangesItAndMovesItsVersion(): void
    {
        $item = $this->add(['title' => 'Speeches', 'startsAt' => '2027-03-06T19:00', 'place' => 'Ballroom']);

        $this->as($this->owner, 'PUT', $this->items($item['id']), ['title' => 'Toasts', 'startsAt' => '2027-03-06T19:30', 'place' => 'Garden'], '"1"');

        self::assertSame(200, $this->statusCode());
        $saved = $this->only();
        self::assertSame(['Toasts', '2027-03-06T19:30:00+01:00', 'Garden', 2], [$saved['title'], $saved['startsAt'], $saved['place'], $saved['version']]);
    }

    #[Test]
    public function aSaveWithoutTheVersionItReadIsRefused(): void
    {
        $item = $this->add(['title' => 'Speeches', 'startsAt' => '2027-03-06T19:00']);

        $this->as($this->owner, 'PUT', $this->items($item['id']), ['title' => 'Toasts', 'startsAt' => '2027-03-06T19:00']);

        self::assertSame(428, $this->statusCode());
        self::assertSame('Speeches', $this->only()['title']);
    }

    #[Test]
    public function aColleaguesChangeSinceTheFormOpenedIsRefused412WithBothVersions(): void
    {
        $colleague = $this->member('ebele@ire.events', 'Ebele Okafor', EventRole::CanEdit);
        $item = $this->add(['title' => 'Speeches', 'startsAt' => '2027-03-06T19:00']);
        $this->as($colleague, 'PUT', $this->items($item['id']), ['title' => 'Toasts', 'startsAt' => '2027-03-06T19:15'], '"1"');
        self::assertSame(200, $this->statusCode());

        $refused = $this->as($this->owner, 'PUT', $this->items($item['id']), ['title' => 'Speeches, short', 'startsAt' => '2027-03-06T19:00'], '"1"');

        self::assertSame(412, $this->statusCode());
        self::assertSame('Ebele Okafor', $refused['changedBy'] ?? null);
        $current = Type\shape(['title' => Type\string(), 'startsAt' => Type\string(), 'version' => Type\int()], true)->coerce($refused['current'] ?? null);
        self::assertSame(['Toasts', '2027-03-06T19:15:00+01:00', 2], [$current['title'], $current['startsAt'], $current['version']]);
        self::assertSame('Toasts', $this->only()['title']);
    }

    #[Test]
    public function deletingAnItemTakesItOff(): void
    {
        $item = $this->add(['title' => 'Speeches', 'startsAt' => '2027-03-06T19:00']);

        $schedule = Type\shape(['items' => Type\vec(Type\mixed())], true)->coerce($this->as($this->owner, 'DELETE', $this->items($item['id']))['schedule'] ?? null);

        self::assertSame(200, $this->statusCode());
        self::assertSame([], $schedule['items']);
    }

    #[Test]
    public function theTwoHundredAndFirstItemIsRefusedAndNothingIsSaved(): void
    {
        $event = self::em()->find(Event::class, $this->eventId) ?? self::fail('no event');

        for ($n = 1; $n <= ScheduleItem::PER_EVENT_MAXIMUM; ++$n) {
            self::em()->persist(new ScheduleItem($event, 'Item ' . $n, new DateTimeImmutable('2027-03-06T18:00:00', new DateTimeZone('UTC')), null));
        }

        self::em()->flush();

        $refused = $this->as($this->owner, 'POST', $this->items(), ['title' => 'One more', 'startsAt' => '2027-03-06T19:00']);

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/schedule_item_limit', $refused['type'] ?? null);
        self::assertSame('This schedule has 200 items, the most an event can hold. Delete one to add another.', $refused['title'] ?? null);
        self::assertSame('This schedule has 200 items, the most an event can hold. Delete one to add another. Nothing was saved.', $refused['detail'] ?? null);
        self::assertCount(200, $this->schedule()['items']);
    }

    #[Test]
    public function withoutManageTheScheduleCanBeReadButNotChanged(): void
    {
        $item = $this->add(['title' => 'Speeches', 'startsAt' => '2027-03-06T19:00']);
        $viewer = $this->member('viewer@ire.events', 'Kemi Ade', EventRole::CanView);

        $this->as($viewer, 'GET', $this->path());
        self::assertSame(200, $this->statusCode());

        $this->as($viewer, 'POST', $this->items(), ['title' => 'Cake', 'startsAt' => '2027-03-06T22:00']);
        self::assertSame(403, $this->statusCode());
        $this->as($viewer, 'PUT', $this->items($item['id']), ['title' => 'Cake', 'startsAt' => '2027-03-06T22:00'], '"1"');
        self::assertSame(403, $this->statusCode());
        $this->as($viewer, 'DELETE', $this->items($item['id']));
        self::assertSame(403, $this->statusCode());
        self::assertSame(['Speeches'], Vec\map($this->schedule()['items'], static fn (array $one): mixed => $one['title']));
    }

    #[Test]
    public function aMemberWithNoRoleOnTheEventHasNoSchedule(): void
    {
        $outsider = $this->member('outsider@ire.events', 'Sade Bello', null);

        $this->as($outsider, 'GET', $this->path());

        self::assertContains($this->statusCode(), [403, 404]);
    }

    #[Test]
    public function anotherOrganisationsEventIsNotFound(): void
    {
        $item = $this->add(['title' => 'Speeches', 'startsAt' => '2027-03-06T19:00']);
        $stranger = $this->account('stranger@elsewhere.events', 'Stranger');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $this->as($stranger, 'GET', $this->path());
        self::assertSame(404, $this->statusCode());
        $this->as($stranger, 'PUT', $this->items($item['id']), ['title' => 'Mine', 'startsAt' => '2027-03-06T19:00'], '"1"');
        self::assertSame(404, $this->statusCode());
        $this->as($stranger, 'DELETE', $this->items($item['id']));
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function everyChangeIsInTheAuditLog(): void
    {
        $item = $this->add(['title' => 'Speeches', 'startsAt' => '2027-03-06T19:00']);
        $this->as($this->owner, 'PUT', $this->items($item['id']), ['title' => 'Toasts', 'startsAt' => '2027-03-06T19:00'], '"1"');
        $this->as($this->owner, 'DELETE', $this->items($item['id']));

        foreach ([ScheduleEditor::ADDED, ScheduleEditor::CHANGED, ScheduleEditor::DELETED] as $action) {
            $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => $action]);
            self::assertCount(1, $entries, $action);
            self::assertSame($item['id'], $entries[0]->getSubjectId()->toRfc4122());
            self::assertSame($this->owner->getId()->toRfc4122(), $entries[0]->getActorId()?->toRfc4122());
        }

        $changed = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => ScheduleEditor::CHANGED]) ?? self::fail('no change');
        self::assertSame(['title' => ['Speeches', 'Toasts']], $changed->getChanges());
    }

    #[Test]
    public function eachChangeIsPublishedAsTheWholeSchedule(): void
    {
        $this->add(['title' => 'Speeches', 'startsAt' => '2027-03-06T19:00']);

        $topic = 'events/' . $this->eventId . '/schedule';
        $update = self::service(RecordingHub::class)->lastOn($topic) ?? self::fail('nothing published');
        self::assertSame([$topic], $update->getTopics());
        $published = Type\shape(['items' => Type\vec(Type\shape(['title' => Type\string()], true))], true)->coerce(Json\decode($update->getData()));
        self::assertSame(['Speeches'], Vec\map($published['items'], static fn (array $item): string => $item['title']));
    }

    #[Test]
    public function aReaderIsGivenATokenForTheSchedule(): void
    {
        $viewer = $this->member('viewer@ire.events', 'Kemi Ade', EventRole::CanView);

        $body = $this->as($viewer, 'POST', $this->path() . '/subscriptions');

        self::assertSame(200, $this->statusCode());
        self::assertIsString($body['token'] ?? null);
    }

    #[Test]
    public function theTimelineHasEachDaysFirstItemAndEveryFixedTimeItemBesideTheEventsOwnDates(): void
    {
        $this->eventId = $this->newEvent('2027-03-12T18:00', '2027-03-13T23:00', 'Africa/Lagos');
        $this->add(['title' => 'Doors', 'startsAt' => '2027-03-12T18:00']);
        $this->add(['title' => 'First dance', 'startsAt' => '2027-03-12T21:00', 'fixedTime' => true]);
        $this->add(['title' => 'Speeches', 'startsAt' => '2027-03-12T22:00']);
        $this->add(['title' => 'After party', 'startsAt' => '2027-03-13T01:00']);
        $this->add(['title' => 'Brunch', 'startsAt' => '2027-03-13T11:00']);

        $timeline = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/timeline');

        self::assertSame(200, $this->statusCode());
        $milestones = Type\vec(Type\shape(['at' => Type\string(), 'title' => Type\string(), 'owner' => Type\string()], true))->coerce($timeline['milestones'] ?? null);
        self::assertSame([
            ['2027-03-12T18:00:00+01:00', 'Owambe starts', 'event'],
            ['2027-03-12T18:00:00+01:00', 'Run of show begins', 'event'],
            ['2027-03-12T21:00:00+01:00', 'First dance', 'event'],
            ['2027-03-13T11:00:00+01:00', 'Run of show begins', 'event'],
            ['2027-03-13T23:00:00+01:00', 'Owambe ends', 'event'],
        ], Vec\map($milestones, static fn (array $milestone): array => [$milestone['at'], $milestone['title'], $milestone['owner']]));
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    private function add(array $body): array
    {
        $answer = $this->as($this->owner, 'POST', $this->items(), $body);
        $id = Type\string()->coerce($answer['itemId'] ?? null);

        foreach ($this->itemsOf($answer['schedule'] ?? null) as $item) {
            if ($item['id'] === $id) {
                return $item;
            }
        }

        self::fail('the added item is not in the answer: ' . Json\encode($answer));
    }

    /** @return array<string, mixed> */
    private function only(): array
    {
        $items = $this->schedule()['items'];
        self::assertCount(1, $items);

        return $items[0];
    }

    /** @return array{timeZone: string, earliest: string, latest: string, itemsMaximum: int, items: list<array<string, mixed>>} */
    private function schedule(): array
    {
        $answer = $this->as($this->owner, 'GET', $this->path());

        return Type\shape([
            'timeZone' => Type\string(),
            'earliest' => Type\string(),
            'latest' => Type\string(),
            'itemsMaximum' => Type\int(),
            'items' => Type\vec(Type\dict(Type\string(), Type\mixed())),
        ])->coerce($answer['schedule'] ?? null);
    }

    /** @return list<array<string, mixed>> */
    private function itemsOf(mixed $schedule): array
    {
        return Type\shape(['items' => Type\vec(Type\dict(Type\string(), Type\mixed()))], true)->coerce($schedule)['items'];
    }

    private function newEvent(string $startsAt, string $endsAt, string $zone): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => $startsAt,
            'endsAt' => $endsAt,
            'timeZone' => $zone,
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function path(): string
    {
        return '/api/events/' . $this->eventId . '/schedule';
    }

    private function items(?string $id = null): string
    {
        return $this->path() . '/items' . (null === $id ? '' : '/' . $id);
    }

    private function violation(string $path): ?string
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        foreach ($violations as $violation) {
            if ($violation['propertyPath'] === $path) {
                return $violation['message'];
            }
        }

        return null;
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $name, ?EventRole $on): User
    {
        $user = $this->account($address, $name);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::Member]) ?? self::fail('no role');
        self::em()->persist(new Membership($organisation, $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        if (null !== $on) {
            self::onEvent($user, $this->eventId, $on);
        }

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null, ?string $ifMatch = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ] + (null === $ifMatch ? [] : ['HTTP_IF_MATCH' => $ifMatch]), content: null === $body ? null : Json\encode($body));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
