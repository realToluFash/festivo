<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Event\Deletion\EventDeleter;
use App\Domain\Event\EventEditor;
use App\Domain\Event\EventLifecycle;
use App\Domain\Messaging\EventMuter;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Trigger;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\EventType;
use App\Enum\SeededRole;
use App\Http\EntityTag;
use App\Tests\Double\Messaging\RecordingPushSender;
use DateTimeImmutable;
use DateTimeZone;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Console\Tester\CommandTester;

/** sc-13214: the members of an event hear when somebody else changes whether, when or where it happens. */
final class EventChangesTest extends MessagingTestCase
{
    use ClockSensitiveTrait;

    private const string ZONE = 'Africa/Lagos';

    private User $ada;

    private User $bola;

    private User $chidi;

    protected function setUp(): void
    {
        parent::setUp();
        self::at('2026-11-02 10:00');
        $this->ada = $this->named('Ada Obi');
        $this->bola = $this->named('Bola Adeyemi');
        $this->chidi = $this->named('Chidi Eze');
    }

    #[Test]
    public function anActionTellsEveryOtherMemberAtOnceAndNotTheOneWhoDidIt(): void
    {
        $event = $this->liveEvent();

        self::service(EventLifecycle::class)->pause($event, $this->ada);
        self::runUntilIdle();

        self::assertSame([], $this->items($this->ada));
        self::assertSame([['title' => 'Ada Obi paused the event', 'lines' => [], 'category' => 'event_changes', 'muted' => false]], $this->items($this->bola));
        self::assertCount(1, $this->items($this->owner));
        self::assertEqualsCanonicalizing(['Bola Adeyemi', 'Chidi Eze', 'OWNER'], self::pushedTo());
        self::assertEqualsCanonicalizing(['Bola Adeyemi', 'Chidi Eze', 'OWNER'], self::sentTo());
        self::assertSame('Paused: Gala', $this->email($this->bola)->subject);
    }

    #[Test]
    public function eachActionHasItsOwnTitleAndSubject(): void
    {
        $event = $this->liveEvent();
        $lifecycle = self::service(EventLifecycle::class);

        $lifecycle->pause($event, $this->ada);
        self::runUntilIdle();
        $this->readAll($this->bola);
        $lifecycle->resume($event, $this->ada);
        self::runUntilIdle();
        $this->readAll($this->bola);
        $lifecycle->end($event, $this->ada);
        self::runUntilIdle();

        self::assertSame(['Paused: Gala', 'Back on: Gala', 'Called off: Gala'], Vec\map($this->emails($this->bola), static fn ($sent): string => $sent->subject));
        self::assertSame('Ada Obi called off the event', $this->items($this->bola)[0]['title']);
    }

    #[Test]
    public function makingADraftLiveTellsButADraftsDetailsDoNot(): void
    {
        $event = $this->draft();

        $this->edit($event, $this->ada, ['startsAt' => '2026-11-13T18:00:00', 'endsAt' => '2026-11-13T23:00:00']);
        self::runUntilIdle();
        self::assertSame([], $this->items($this->bola));

        self::service(EventLifecycle::class)->makeLive($event, $this->ada);
        self::runUntilIdle();

        self::assertSame('Ada Obi made the event live', $this->items($this->bola)[0]['title']);
        self::assertSame('Live: Gala', $this->email($this->bola)->subject);
    }

    #[Test]
    public function aNameChangeTellsNobody(): void
    {
        $event = $this->liveEvent();

        $this->edit($event, $this->ada, ['name' => 'Grand gala']);
        self::runUntilIdle();

        self::assertSame(0, self::rowCount('SELECT COUNT(*) FROM event_changes'));
        self::assertSame([], $this->items($this->bola));
    }

    #[Test]
    public function aFinishedEventsCorrectionTellsNobody(): void
    {
        $event = $this->liveEvent();
        self::at('2026-11-13 10:00');

        $this->edit($event, $this->ada, ['venue' => ['name' => 'Hall B', 'address' => null]]);
        self::runUntilIdle();

        self::assertSame([], $this->items($this->bola));
    }

    #[Test]
    public function aMovedDateIsInTheBellAtOnceAndPushesOnceItHasSettledFor15Minutes(): void
    {
        $event = $this->liveEvent();

        $this->edit($event, $this->ada, ['startsAt' => '2026-11-13T18:00:00', 'endsAt' => '2026-11-13T23:00:00']);
        self::runUntilIdle();

        self::assertSame(['The date is now Friday, 13 November 2026 (was Thursday, 12 November 2026).'], $this->items($this->bola)[0]['lines']);
        self::assertSame([], self::pushedTo());

        self::at('2026-11-02 10:10');
        $this->edit($event, $this->ada, ['startsAt' => '2026-11-13T19:00:00']);
        self::runUntilIdle();
        self::at('2026-11-02 10:20');
        self::runUntilIdle();
        self::assertSame([], self::pushedTo(), 'The second edit set the 15 minutes going again.');

        self::at('2026-11-02 10:25');
        self::runUntilIdle();

        self::assertCount(1, $this->pushes($this->bola));
        self::assertSame(
            "Ada Obi changed the event\nThe date is now Friday, 13 November 2026 (was Thursday, 12 November 2026).\nThe start time is now 19:00 (was 18:00).",
            $this->pushes($this->bola)[0]->body,
        );
        self::assertSame('Gala', $this->pushes($this->bola)[0]->subject);
        self::assertSame('Changed: Gala', $this->email($this->bola)->subject);
        self::assertCount(1, $this->items($this->bola), 'Both edits are one item.');
    }

    #[Test]
    public function aMembersOwnEditWhileAnEarlierItemIsUnreadSendsThemNothing(): void
    {
        $event = $this->liveEvent();

        $this->edit($event, $this->ada, ['venue' => ['name' => 'Hall B', 'address' => null]]);
        self::runUntilIdle();
        self::at('2026-11-02 10:15');
        self::runUntilIdle();
        self::assertCount(1, $this->pushes($this->bola));
        self::assertCount(1, $this->emails($this->bola));

        self::at('2026-11-02 11:00');
        $this->edit($event, $this->bola, ['startsAt' => '2026-11-13T18:00:00', 'endsAt' => '2026-11-13T23:00:00']);
        self::runUntilIdle();
        self::at('2026-11-02 11:15');
        self::runUntilIdle();

        self::assertCount(1, $this->pushes($this->bola));
        self::assertCount(1, $this->emails($this->bola));
        self::assertCount(1, $this->pushes($this->ada));
    }

    #[Test]
    public function theEmailEndsWithALinkToNotificationSettings(): void
    {
        $event = $this->liveEvent();

        self::service(EventLifecycle::class)->pause($event, $this->ada);
        self::runUntilIdle();

        $lines = Vec\reverse(Str\split($this->email($this->bola)->body, "\n"));

        self::assertStringStartsWith('You get this because you are on Gala at ', $lines[1]);
        self::assertMatchesRegularExpression('#^Notification settings: \S+/app/account/notifications$#', $lines[0]);
    }

    #[Test]
    public function aFieldChangedBackWithinTheWindowSendsNothingAndTakesItsItemAway(): void
    {
        $event = $this->liveEvent();

        $this->edit($event, $this->ada, ['venue' => ['name' => 'Hall B', 'address' => null]]);
        self::runUntilIdle();
        self::assertCount(1, $this->items($this->bola));

        $this->edit($event, $this->ada, ['venue' => ['name' => 'Hall A', 'address' => null]]);
        self::runUntilIdle();
        self::at('2026-11-02 10:30');
        self::runUntilIdle();

        self::assertSame([], $this->items($this->bola));
        self::assertSame([], self::pushedTo());
        self::assertSame([], self::sentTo());
    }

    #[Test]
    public function theVenueReadsByItsNameOrItsAddress(): void
    {
        $event = $this->liveEvent(venue: null);

        $this->edit($event, $this->ada, ['venue' => ['name' => 'Hall B', 'address' => null]]);
        $this->settleAndRead();
        $this->edit($event, $this->ada, ['venue' => null]);
        $this->settleAndRead();
        $this->edit($event, $this->ada, ['venue' => ['name' => null, 'address' => '3 Bourdillon Road, Ikoyi']]);
        $this->settleAndRead();
        $this->edit($event, $this->ada, ['venue' => ['name' => null, 'address' => '12 Admiralty Way, Lekki']]);
        $this->settleAndRead();
        $this->edit($event, $this->ada, ['venue' => ['name' => 'Hall A', 'address' => '12 Admiralty Way, Lekki']]);
        $this->settleAndRead();
        $this->edit($event, $this->ada, ['venue' => ['name' => 'Hall A', 'address' => '3 Bourdillon Road, Ikoyi']]);
        $this->settleAndRead();

        self::assertSame([
            ['The venue is now 3 Bourdillon Road, Ikoyi (was 12 Admiralty Way, Lekki).'],
            ['The venue is now Hall A (was 12 Admiralty Way, Lekki).'],
            ['The venue is now 12 Admiralty Way, Lekki (was 3 Bourdillon Road, Ikoyi).'],
            ['The venue is now 3 Bourdillon Road, Ikoyi.'],
            ['The venue is to be confirmed (was Hall B).'],
            ['The venue is now Hall B.'],
        ], Vec\map($this->items($this->bola), static fn (array $item): array => $item['lines']));
    }

    #[Test]
    public function aKeptNameWhoseAddressMovesGivesTheAddressOnBothSides(): void
    {
        $event = $this->liveEvent(venue: ['name' => 'Hall A', 'address' => '3 Bourdillon Road, Ikoyi']);

        $this->edit($event, $this->ada, ['venue' => ['name' => 'Hall A', 'address' => '12 Admiralty Way, Lekki']]);
        $this->settleAndRead();
        self::at('2026-11-02 10:30');
        self::runUntilIdle();

        self::assertSame(['The venue is now 12 Admiralty Way, Lekki (was 3 Bourdillon Road, Ikoyi).'], $this->items($this->bola)[0]['lines']);
        self::assertStringContainsString("12 Admiralty Way, Lekki\nOpen in maps: https://www.google.com/maps/search/?api=1&query=12%20Admiralty%20Way%2C%20Lekki", $this->email($this->bola)->body);
    }

    #[Test]
    public function aTimeZoneThatReadsTheSameOnBothSidesMakesNoItem(): void
    {
        $event = $this->liveEvent(zone: 'Europe/Paris');

        $this->edit($event, $this->ada, ['timeZone' => 'Europe/Madrid']);
        self::at('2026-11-02 10:30');
        self::runUntilIdle();

        self::assertSame([], $this->items($this->bola));
        self::assertSame([], self::sentTo());
    }

    #[Test]
    public function aChangeFrom24HoursBeforeTheStartIsEventDay(): void
    {
        $event = $this->liveEvent(startsOn: '2026-11-03');

        self::at('2026-11-02 18:00');
        self::service(EventLifecycle::class)->pause($event, $this->ada);
        self::runUntilIdle();

        self::assertSame('event_day', $this->items($this->bola)[0]['category']);
        self::assertSame([], Vec\filter(self::service(RecordingPushSender::class)->sent, static fn (array $sent): bool => 'event_day' !== $sent['category']->value));
        self::assertCount(3, self::pushedTo());
        self::assertSame([], self::sentTo(), "Event day's email is off by default.");
    }

    #[Test]
    public function aMinuteBeforeThe24HoursIsAnOrdinaryChange(): void
    {
        $event = $this->liveEvent(startsOn: '2026-11-03');

        self::at('2026-11-02 17:59');
        self::service(EventLifecycle::class)->pause($event, $this->ada);
        self::runUntilIdle();

        self::assertSame('event_changes', $this->items($this->bola)[0]['category']);
    }

    #[Test]
    public function movingTomorrowsEventToNextWeekAndNextWeeksToTomorrowAreBothEventDay(): void
    {
        $tomorrow = $this->liveEvent(startsOn: '2026-11-03');
        $nextWeek = $this->liveEvent(startsOn: '2026-11-09');
        self::at('2026-11-02 19:00');

        $this->edit($tomorrow, $this->ada, ['startsAt' => '2026-11-09T18:00:00', 'endsAt' => '2026-11-09T23:00:00']);
        $this->edit($nextWeek, $this->ada, ['startsAt' => '2026-11-03T18:00:00', 'endsAt' => '2026-11-03T23:00:00']);
        self::runUntilIdle();

        self::assertSame(['event_day', 'event_day'], Vec\map($this->items($this->bola), static fn (array $item): string => $item['category']));
    }

    #[Test]
    public function anUnreadEventChangesItemTakesAnEventDayChangeAndBecomesEventDay(): void
    {
        $event = $this->liveEvent(startsOn: '2026-11-04');

        $this->edit($event, $this->ada, ['venue' => ['name' => 'Hall B', 'address' => null]]);
        self::runUntilIdle();
        self::assertSame('event_changes', $this->items($this->bola)[0]['category']);

        self::at('2026-11-03 19:00');
        self::service(EventLifecycle::class)->pause($event, $this->bola);
        self::runUntilIdle();

        self::assertSame([['title' => 'Bola Adeyemi paused the event', 'lines' => ['The venue is now Hall B (was Hall A).', 'Also changed by Ada Obi.'], 'category' => 'event_day', 'muted' => false]], $this->items($this->chidi));
    }

    #[Test]
    public function aPushDueAtNightWaitsFor0800AndGoesAsTheItemThenReads(): void
    {
        $event = $this->liveEvent();
        $this->bola->setTimezone(self::ZONE);
        self::em()->flush();

        self::at('2026-11-02 22:00');
        self::service(EventLifecycle::class)->pause($event, $this->ada);
        self::runUntilIdle();
        self::assertSame([], $this->pushes($this->bola));
        self::assertCount(1, $this->emails($this->bola), 'The email does not wait.');

        self::at('2026-11-02 23:00');
        self::service(EventLifecycle::class)->resume($event, $this->chidi);
        self::runUntilIdle();

        self::at('2026-11-03 08:00');
        self::runUntilIdle();

        self::assertSame(["Chidi Eze resumed the event\nAlso changed by Ada Obi."], Vec\map($this->pushes($this->bola), static fn ($sent): string => $sent->body));
    }

    #[Test]
    public function aPushHeldOvernightIsDroppedOnceItsItemIsRead(): void
    {
        $event = $this->liveEvent();
        $this->bola->setTimezone(self::ZONE);
        self::em()->flush();

        self::at('2026-11-02 22:00');
        self::service(EventLifecycle::class)->pause($event, $this->ada);
        self::runUntilIdle();
        $this->readAll($this->bola);

        self::at('2026-11-03 08:00');
        self::runUntilIdle();

        self::assertSame([], $this->pushes($this->bola));
    }

    #[Test]
    public function aMutedEventKeepsTheItemMarkedMutedWithNoPushOrEmail(): void
    {
        $event = $this->liveEvent();
        self::service(EventMuter::class)->set($this->bola, $event, true);

        self::service(EventLifecycle::class)->pause($event, $this->ada);
        self::runUntilIdle();

        self::assertTrue($this->items($this->bola)[0]['muted']);
        self::assertSame([], $this->pushes($this->bola));
        self::assertSame([], $this->emails($this->bola));
    }

    #[Test]
    public function aMutedEventStillPushesAnEventDayItem(): void
    {
        $event = $this->liveEvent(startsOn: '2026-11-03');
        self::service(EventMuter::class)->set($this->bola, $event, true);

        self::at('2026-11-03 09:00');
        self::service(EventLifecycle::class)->pause($event, $this->ada);
        self::runUntilIdle();

        self::assertFalse($this->items($this->bola)[0]['muted']);
        self::assertCount(1, $this->pushes($this->bola));
    }

    #[Test]
    public function aMemberWhoLostEventsReadByTheTimeItGoesGetsNothing(): void
    {
        $event = $this->liveEvent();

        self::service(EventLifecycle::class)->pause($event, $this->ada);
        self::connection()->executeStatement('DELETE FROM memberships WHERE user_id = :user', ['user' => $this->bola->getId()->toRfc4122()]);
        self::runUntilIdle();

        self::assertSame([], $this->items($this->bola));
        self::assertSame([], $this->emails($this->bola));
    }

    #[Test]
    public function aDeletionStillTellsWithTheTimeSupportCanRestoreItUntil(): void
    {
        $event = $this->liveEvent();
        $this->bola->setTimezone(self::ZONE);
        self::em()->flush();

        self::service(EventDeleter::class)->delete($event, $this->ada, 'Gala');
        self::runUntilIdle();

        self::assertSame(['title' => 'Ada Obi deleted the event', 'lines' => ['Soirely support can restore it until Wednesday 2 Dec at 10:00 WAT.'], 'category' => 'event_changes', 'muted' => false], $this->items($this->bola)[0]);
        self::assertSame('Deleted: Gala', $this->email($this->bola)->subject);
        self::assertStringNotContainsString('Open the event', $this->email($this->bola)->body);
        self::assertNull($this->pushes($this->bola)[0]->place, "A deletion's push opens the bell.");
    }

    #[Test]
    public function aRestoreWhileTheDeletionIsUnreadTakesItsItemOver(): void
    {
        $event = $this->liveEvent();
        self::service(EventDeleter::class)->delete($event, $this->ada, 'Gala');
        self::runUntilIdle();

        $this->restore($event);
        self::runUntilIdle();

        self::assertSame([['title' => 'Soirely support restored the event', 'lines' => ['Also changed by Ada Obi.'], 'category' => 'event_changes', 'muted' => false]], $this->items($this->bola));
        self::assertSame('Restored: Gala', $this->emails($this->bola)[1]->subject);
    }

    #[Test]
    public function aRestoreAfterTheDeletionWasReadIsAnItemOfItsOwn(): void
    {
        $event = $this->liveEvent();
        self::service(EventDeleter::class)->delete($event, $this->ada, 'Gala');
        self::runUntilIdle();
        $this->readAll($this->bola);

        $this->restore($event);
        self::runUntilIdle();

        self::assertSame(['Soirely support restored the event', 'Ada Obi deleted the event'], Vec\map($this->items($this->bola), static fn (array $item): string => $item['title']));
        self::assertSame([], $this->items($this->bola)[0]['lines']);
    }

    #[Test]
    public function anItemWithTwoPeoplesChangesLeadsWithTheActionAndNamesTheOther(): void
    {
        $event = $this->liveEvent();

        $this->edit($event, $this->ada, ['venue' => ['name' => 'Hall B', 'address' => null]]);
        self::service(EventLifecycle::class)->pause($event, $this->bola);
        self::runUntilIdle();

        self::assertSame(['Bola Adeyemi paused the event', ['The venue is now Hall B (was Hall A).', 'Also changed by Ada Obi.']], [$this->items($this->chidi)[0]['title'], $this->items($this->chidi)[0]['lines']]);
        self::assertSame('Paused: Gala', $this->email($this->chidi)->subject);
        self::assertSame(['Bola Adeyemi paused the event', []], [$this->items($this->ada)[0]['title'], $this->items($this->ada)[0]['lines']], "Ada's own change is not news to her; Bola's pause is.");
    }

    #[Test]
    public function anItemWithThreePeoplesChangesCountsTheRest(): void
    {
        $event = $this->liveEvent();

        $this->edit($event, $this->chidi, ['startsAt' => '2026-11-12T19:00:00']);
        $this->edit($event, $this->ada, ['venue' => ['name' => 'Hall B', 'address' => null]]);
        self::service(EventLifecycle::class)->end($event, $this->bola);
        self::runUntilIdle();

        self::assertSame([
            'title' => 'Bola Adeyemi called off the event',
            'lines' => ['The start time is now 19:00 (was 18:00).', 'The venue is now Hall B (was Hall A).', 'Also changed by Ada Obi and 1 other person.'],
            'category' => 'event_changes',
            'muted' => false,
        ], $this->items($this->owner)[0]);
    }

    #[Test]
    public function aPersonWhoseOnlyChangeWasChangedBackLeavesTheItem(): void
    {
        $event = $this->liveEvent();

        $this->edit($event, $this->ada, ['startsAt' => '2026-11-13T18:00:00', 'endsAt' => '2026-11-13T23:00:00']);
        $this->edit($event, $this->bola, ['venue' => ['name' => 'Hall B', 'address' => null]]);
        $this->edit($event, $this->ada, ['startsAt' => '2026-11-12T18:00:00', 'endsAt' => '2026-11-12T23:00:00']);
        self::runUntilIdle();

        self::assertSame(['title' => 'Bola Adeyemi changed the event', 'lines' => ['The venue is now Hall B (was Hall A).'], 'category' => 'event_changes', 'muted' => false], $this->items($this->chidi)[0]);
    }

    #[Test]
    public function aDoubledJobSendsOnce(): void
    {
        $event = $this->liveEvent();
        self::service(EventLifecycle::class)->pause($event, $this->ada);
        $row = self::connection()->fetchAssociative("SELECT type, cancellation_key, source_id, payload FROM scheduled_notifications WHERE type = 'event_changes.notice'") ?: throw new LogicException('No notice.');
        self::runUntilIdle();

        self::scheduler()->schedule(
            Type\string()->coerce($row['type']),
            Type\string()->coerce($row['cancellation_key']),
            Type\string()->coerce($row['source_id']),
            Trigger::at(self::now()),
            Audience::membersWithPermission($this->organisation->getId(), \App\Enum\Permission::EventsRead),
            Json\typed(Type\string()->coerce($row['payload']), Type\dict(Type\string(), Type\mixed())),
            $event,
        );
        self::runUntilIdle();

        self::assertCount(1, $this->emails($this->bola));
        self::assertCount(1, $this->pushes($this->bola));
    }

    private function named(string $name): User
    {
        $user = $this->member(Str\lowercase(Str\split($name, ' ')[0]), SeededRole::Administrator);
        $user->setName($name);
        self::em()->flush();

        return $user;
    }

    /** @param ?array{name: ?string, address: ?string} $venue */
    private function liveEvent(string $startsOn = '2026-11-12', ?array $venue = ['name' => 'Hall A', 'address' => null], string $zone = self::ZONE): Event
    {
        $event = $this->draft($startsOn, $venue, $zone);
        $event->makeLive(self::now());
        self::em()->flush();

        return $event;
    }

    /** @param ?array{name: ?string, address: ?string} $venue */
    private function draft(string $startsOn = '2026-11-12', ?array $venue = ['name' => 'Hall A', 'address' => null], string $zone = self::ZONE): Event
    {
        $starts = new DateTimeImmutable($startsOn . ' 18:00', new DateTimeZone($zone));
        $event = new Event($this->organisation, 'Gala', EventType::Wedding, $starts, $starts->modify('+5 hours'), 'NGN');
        $event->setHosts(['Ada Obi']);
        $event->setVenue($venue['name'] ?? null, $venue['address'] ?? null, null, null, null, null, null, null, null, null);
        self::em()->persist($event);
        self::em()->flush();

        return $event;
    }

    /** @param array{name?: string, type?: ?string, startsAt?: string, endsAt?: string, timeZone?: string, currency?: string, venue?: array{name?: ?string, address?: ?string, addressId?: ?string}|null, hosts?: list<string>} $fields */
    private function edit(Event $event, User $by, array $fields): void
    {
        self::service(EventEditor::class)->edit($event, EntityTag::of($event->getVersion()), $by, $fields);
    }

    private function restore(Event $event): void
    {
        $command = new CommandTester(new Application(self::$kernel ?? throw new LogicException('No kernel.'))->find('app:restore-event'));
        self::assertSame(0, $command->execute(['event' => $event->getId()->toRfc4122(), '--agent' => 'Kemi at support']));
        self::em()->clear();
    }

    private function settleAndRead(): void
    {
        self::runUntilIdle();
        $this->readAll($this->bola);
        self::at(self::now()->modify('+1 minute')->setTimezone(new DateTimeZone(self::ZONE))->format('Y-m-d H:i'));
    }

    private function readAll(User $user): void
    {
        self::connection()->executeStatement('UPDATE notification_items SET read_at = created_at WHERE user_id = :user AND read_at IS NULL', ['user' => $user->getId()->toRfc4122()]);
    }

    /** @return list<array{title: string, lines: list<string>, category: string, muted: bool}> newest first */
    private function items(User $user): array
    {
        return Vec\map(
            self::connection()->fetchAllAssociative('SELECT title, lines, category, muted FROM notification_items WHERE user_id = :user ORDER BY created_at DESC, id DESC', ['user' => $user->getId()->toRfc4122()]),
            static fn (array $row): array => [
                'title' => Type\string()->coerce($row['title']),
                'lines' => Json\typed(Type\string()->coerce($row['lines']), Type\vec(Type\string())),
                'category' => Type\string()->coerce($row['category']),
                'muted' => Type\bool()->coerce($row['muted']),
            ],
        );
    }

    /** @return list<\App\Domain\Messaging\Model\RenderedNotification> */
    private function emails(User $user): array
    {
        return Vec\values(Vec\map(
            Vec\filter(self::sender()->sent, static fn (array $sent): bool => $sent['recipient']->id->equals($user->getId())),
            static fn (array $sent) => $sent['notification'],
        ));
    }

    private function email(User $user): \App\Domain\Messaging\Model\RenderedNotification
    {
        return $this->emails($user)[0] ?? self::fail('No email.');
    }

    /** @return list<\App\Domain\Messaging\Model\RenderedNotification> */
    private function pushes(User $user): array
    {
        return Vec\values(Vec\map(
            Vec\filter(self::service(RecordingPushSender::class)->sent, static fn (array $sent): bool => $sent['recipient']->id->equals($user->getId())),
            static fn (array $sent) => $sent['notification'],
        ));
    }

    /** @return list<string> */
    private static function pushedTo(): array
    {
        return Vec\map(self::service(RecordingPushSender::class)->sent, static fn (array $sent): string => $sent['recipient']->name);
    }

    private static function at(string $localTime): void
    {
        self::mockTime(new DateTimeImmutable($localTime, new DateTimeZone(self::ZONE))->setTimezone(new DateTimeZone('UTC')));
    }

    private static function now(): DateTimeImmutable
    {
        return self::service(ClockInterface::class)->now();
    }
}
