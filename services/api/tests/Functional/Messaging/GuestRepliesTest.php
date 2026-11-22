<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Link\InvitationLinks;
use App\Domain\Guest\Model\CompanionChoice;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Guest\Model\PageReply;
use App\Domain\Guest\Model\RecordedReply;
use App\Domain\Guest\Reply\GuestAnswers;
use App\Domain\Messaging\EventMuter;
use App\Domain\Messaging\GuestReplies\GuestRepliesSummary;
use App\Domain\Messaging\GuestReplies\GuestRepliesUnsubscribe;
use App\Domain\Messaging\GuestReplies\GuestReplyLog;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Domain\Messaging\Model\Trigger;
use App\Domain\Messaging\NotificationReadMarker;
use App\Entity\Event;
use App\Entity\EventPerson;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\Membership;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\NotificationItem;
use App\Entity\SeatAssignment;
use App\Entity\SeatingPlan;
use App\Entity\SeatingTable;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\EventType;
use App\Enum\GuestChangeKind;
use App\Enum\GuestInvitationMethod;
use App\Enum\GuestReply;
use App\Enum\GuestReplyHow;
use App\Enum\MealAnswerKind;
use App\Enum\NeedKind;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Enum\TableShape;
use App\Repository\GuestRepository;
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
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

/** sc-4331: every guest reply is in the bell at once, push is batched, and email comes once a day. */
final class GuestRepliesTest extends MessagingTestCase
{
    use ClockSensitiveTrait;

    private const string ZONE = 'Africa/Lagos';

    private User $ada;

    private Event $event;

    protected function setUp(): void
    {
        parent::setUp();
        self::at('2026-11-02 10:00');
        $this->ada = $this->member('ada', SeededRole::Admin);
        $this->ada->setName('Ada Obi');
        $this->ada->setTimezone(self::ZONE);
        $this->owner->setTimezone(self::ZONE);
        self::em()->flush();
        $this->event = $this->wedding();
    }

    #[Test]
    public function repliesReachEveryMemberWithGuestsReadAsOneItemPerEventKeptUpToDate(): void
    {
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);
        $this->reply($this->guest('Kemi Ade'), GuestReply::NotComing);
        $changed = $this->guest('Femi Ojo');
        $this->reply($changed, GuestReply::Coming);
        self::at('2026-11-02 10:01');
        $this->readAll($this->ada);
        self::at('2026-11-02 10:02');
        $this->reply($changed, GuestReply::NotComing);
        $this->reply($this->guest('Bisi Oke'), GuestReply::Coming);

        self::assertSame(['1 coming, 1 changed their reply', '2 coming, 1 not coming'], $this->titles($this->ada));
        self::assertSame(['2 coming, 2 not coming'], Vec\take($this->titles($this->owner), 1), 'A first reply changed before the member looked counts as the answer it is now.');
        self::assertSame(1, self::rowCount('SELECT COUNT(*) FROM notification_items WHERE user_id = :user AND read_at IS NULL', ['user' => $this->ada->getId()->toRfc4122()]));
    }

    #[Test]
    public function aMemberWithoutGuestsReadIsNotTold(): void
    {
        $outsider = $this->member('chidi', SeededRole::Member);
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);

        self::assertSame([], $this->titles($outsider));
    }

    #[Test]
    public function openingTheItemIsALookSoOnlyLaterChangesCountAndTheItemOpensFromTheLookBefore(): void
    {
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);
        self::assertSame('/app/events/' . $this->eventId() . '/guests?filter=changed&since=all', $this->place($this->ada));

        self::at('2026-11-02 10:01');
        $this->open($this->ada);
        self::at('2026-11-02 10:05');
        $this->reply($this->guest('Kemi Ade'), GuestReply::Maybe);

        self::assertSame(['1 not sure yet', '1 coming'], $this->titles($this->ada));
        self::assertSame('/app/events/' . $this->eventId() . '/guests?filter=changed&since=' . \rawurlencode('2026-11-02T09:01:00+00:00'), $this->place($this->ada));
        self::assertSame(['Kemi Ade'], Vec\map($this->log()->unseen($this->ada->getId(), $this->eventId())->rows, static fn ($row): string => $row->name));
    }

    #[Test]
    public function aGuestWhoseOnlyChangeIsTheirNeedsIsCountedUnderChangedWithItsLabel(): void
    {
        $this->needs($this->guest('Tomi Bello'), ['vegan']);
        $this->flag($this->guest('Kemi Ade'));

        self::assertSame(['1 updated dietary needs, 1 link may have reached the wrong person'], $this->titles($this->ada));
        $rows = $this->log()->unseen($this->ada->getId(), $this->eventId())->rows;
        self::assertSame([GuestChangeKind::Flagged, GuestChangeKind::Needs], Vec\map($rows, static fn ($row): GuestChangeKind => $row->kind));
    }

    #[Test]
    public function aGuestWithAReplyAndANeedsChangeShowsTheReply(): void
    {
        $guest = $this->guest('Tomi Bello');
        $this->reply($guest, GuestReply::Coming, ['vegan']);

        self::assertSame(['1 coming'], $this->titles($this->ada));
    }

    #[Test]
    public function theFirstReplyInAnHourPushesAndTheRestJoinTheNextPushWhenTheHourIsUp(): void
    {
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);
        self::assertSame(['1 new reply · Gala'], $this->pushes($this->ada));

        self::at('2026-11-02 10:10');
        $this->reply($this->guest('Kemi Ade'), GuestReply::Coming);
        self::at('2026-11-02 10:40');
        $this->reply($this->guest('Femi Ojo'), GuestReply::NotComing);
        self::at('2026-11-02 10:59');
        self::runUntilIdle();
        self::assertSame(['1 new reply · Gala'], $this->pushes($this->ada));

        self::at('2026-11-02 11:00');
        self::runUntilIdle();
        self::assertSame(['1 new reply · Gala', '2 new replies · Gala'], $this->pushes($this->ada));
    }

    #[Test]
    public function aPushThatAlsoHoldsANonReplyIsWordedAsUpdates(): void
    {
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);
        self::at('2026-11-02 10:10');
        $this->reply($this->guest('Kemi Ade'), GuestReply::Coming);
        $this->needs($this->guest('Femi Ojo'), ['vegan']);
        self::at('2026-11-02 11:00');
        self::runUntilIdle();

        self::assertSame(['1 new reply · Gala', '2 updates from guests · Gala'], $this->pushes($this->ada));
    }

    #[Test]
    public function nothingPushesAtNightAndTheNightsRepliesGoAsOnePushAt0800(): void
    {
        self::at('2026-11-02 22:00');
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);
        self::at('2026-11-02 23:30');
        $this->reply($this->guest('Kemi Ade'), GuestReply::Coming);
        self::at('2026-11-03 06:00');
        self::runUntilIdle();
        self::assertSame([], $this->pushes($this->ada));

        self::at('2026-11-03 08:00');
        self::runUntilIdle();

        self::assertSame(['2 new replies · Gala'], $this->pushes($this->ada));
    }

    #[Test]
    public function aMemberWhoOpenedTheItemGetsNoPushForWhatTheySaw(): void
    {
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);
        self::at('2026-11-02 10:10');
        $this->reply($this->guest('Kemi Ade'), GuestReply::Coming);
        self::at('2026-11-02 10:11');
        $this->open($this->ada);
        self::at('2026-11-02 11:00');
        self::runUntilIdle();

        self::assertSame(['1 new reply · Gala'], $this->pushes($this->ada));
    }

    #[Test]
    public function theSummaryGoesAt0800WithWhatIsUnseenAndTheUnsubscribeHeader(): void
    {
        $this->event->setReplyBy(new DateTimeImmutable('2026-11-08'));
        self::em()->flush();
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);
        $this->reply($this->guest('Kemi Ade'), GuestReply::NotComing);
        $this->guest('Femi Ojo');
        $this->flag($this->guest('Bisi Oke'));
        self::assertSame([], $this->emails($this->ada));

        self::at('2026-11-03 08:00');
        self::runUntilIdle();

        $email = $this->emails($this->ada)[0] ?? self::fail('No summary.');
        self::assertSame('Gala: 2 new replies', $email->subject);
        self::assertSame(self::service(GuestRepliesUnsubscribe::class)->url($this->ada->getId()), $email->unsubscribe);
        self::assertSame(Str\join([
            'Your guest summary',
            '',
            'What changed since 2 November 2026.',
            '',
            'Gala',
            '12 November 2026',
            'Coming: 1',
            'Tomi Bello',
            'Not coming: 1',
            'Kemi Ade',
            'Still waiting: 2',
            'Replies close on 8 November 2026.',
            'Link may have reached the wrong person:',
            'Bisi Oke',
            'Replace their link from the guest list.',
            'Open the guest list: https://app.soirely.test/app/events/' . $this->eventId() . '/guests',
            '',
            'You get this because you can see the guests of these events in Notified Events.',
            'Turn off guest reply emails: ' . self::service(GuestRepliesUnsubscribe::class)->url($this->ada->getId()),
            'Notification settings: https://app.soirely.test/app/account/notifications',
        ], "\n"), $email->body);
    }

    #[Test]
    public function theSummaryListsTenNamesThenHowManyMore(): void
    {
        foreach (Vec\range(1, 12) as $n) {
            $this->reply($this->guest('Guest ' . Str\pad_left((string) $n, 2, '0')), GuestReply::Coming);
        }

        self::at('2026-11-03 08:00');
        self::runUntilIdle();

        self::assertStringContainsString("Coming: 12\nGuest 12, Guest 11, Guest 10, Guest 09, Guest 08, Guest 07, Guest 06, Guest 05, Guest 04, Guest 03 and 2 more\n", ($this->emails($this->ada)[0] ?? self::fail('No summary.'))->body);
    }

    #[Test]
    public function noSummaryGoesWhenEverythingWasReadInTheBell(): void
    {
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);
        self::at('2026-11-02 10:01');
        $this->open($this->ada);

        self::at('2026-11-03 08:00');
        self::runUntilIdle();

        self::assertSame([], $this->emails($this->ada));
        self::assertCount(1, $this->emails($this->owner));
    }

    #[Test]
    public function inEventWeekTheSummaryCountsWhoIsNotSeated(): void
    {
        self::connection()->insert('seating_plans', ['id' => Uuid::v7()->toRfc4122(), 'event_id' => $this->eventId(), 'width_cm' => 1000, 'length_cm' => 1000, 'created_at' => '2026-11-01 00:00:00', 'updated_at' => '2026-11-01 00:00:00']);
        self::at('2026-11-06 10:00');
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);

        self::at('2026-11-07 08:00');
        self::runUntilIdle();

        self::assertStringContainsString("Not seated: 1\n", ($this->emails($this->ada)[0] ?? self::fail('No summary.'))->body);
    }

    #[Test]
    public function inEventWeekTheSummaryCountsEachPersonComingWithACourseNotChosenOnceAfterNotSeated(): void
    {
        self::connection()->insert('seating_plans', ['id' => Uuid::v7()->toRfc4122(), 'event_id' => $this->eventId(), 'width_cm' => 1000, 'length_cm' => 1000, 'created_at' => '2026-11-01 00:00:00', 'updated_at' => '2026-11-01 00:00:00']);
        $starter = $this->course('Starter');
        $main = $this->course('Main');
        self::at('2026-11-06 10:00');
        $tomi = $this->guest('Tomi Bello');
        $this->reply($tomi, GuestReply::Coming);
        $this->companion($tomi, 'Chidi Eze');
        $kemi = $this->guest('Kemi Ade');
        $this->reply($kemi, GuestReply::Coming);
        $this->answer($kemi, $starter, MealAnswerKind::ChefsChoice);
        $this->answer($kemi, $main, MealAnswerKind::Skipped);
        $bisi = $this->guest('Bisi Oke');
        $this->reply($bisi, GuestReply::Coming);
        $this->answer($bisi, $starter, MealAnswerKind::NeedsHost);
        $this->reply($this->guest('Femi Ojo'), GuestReply::NotComing);
        $this->reply($this->guest('Sade Ola'), GuestReply::Maybe);
        $this->guest('Yemi Ajayi');

        self::at('2026-11-07 08:00');
        self::runUntilIdle();

        self::assertStringContainsString("Not seated: 4\nNo meal chosen: 3\n", ($this->emails($this->ada)[0] ?? self::fail('No summary.'))->body, 'Tomi once for two courses, Chidi as their companion, Bisi for Main; Kemi answered both, and Femi, Sade and Yemi are not coming.');
    }

    #[Test]
    public function notSeatedLeavesOutACompanionTheirGuestMarkedNotComingAsNoMealChosenDoes(): void
    {
        $this->seatingPlan();
        $this->course('Main');
        self::at('2026-11-05 10:00');
        $tomi = $this->guest('Tomi Bello');
        $this->companion($tomi, 'Chidi Eze');
        $this->companion($tomi, 'Ngozi Eze');
        $this->reply($tomi, GuestReply::Coming);

        self::at('2026-11-06 08:00');
        self::runUntilIdle();

        self::assertStringContainsString("Not seated: 3\nNo meal chosen: 3\n", ($this->emails($this->ada)[0] ?? self::fail('No summary.'))->body);

        self::at('2026-11-06 10:00');
        $this->companionsComing($tomi, ['Chidi Eze' => false, 'Ngozi Eze' => true]);
        $this->reply($this->guest('Femi Ojo'), GuestReply::NotComing);

        self::at('2026-11-07 08:00');
        self::runUntilIdle();

        self::assertStringContainsString("Not seated: 2\nNo meal chosen: 2\n", ($this->emails($this->ada)[1] ?? self::fail('No second summary.'))->body, 'Chidi is out of both lines.');

        self::at('2026-11-07 10:00');
        $this->companionsComing($tomi, ['Chidi Eze' => true, 'Ngozi Eze' => true]);
        $this->reply($this->guest('Sade Ola'), GuestReply::NotComing);

        self::at('2026-11-08 08:00');
        self::runUntilIdle();

        self::assertStringContainsString("Not seated: 3\nNo meal chosen: 3\n", ($this->emails($this->ada)[2] ?? self::fail('No third summary.'))->body, 'Chidi is back in both.');
    }

    #[Test]
    public function notSeatedNeverCountsAWalkInAndFallsAsPeopleAreSeatedUntilItHasNoLine(): void
    {
        $table = $this->seatingPlan();
        self::at('2026-11-05 10:00');
        $tomi = $this->guest('Tomi Bello');
        $this->companion($tomi, 'Chidi Eze');
        $this->reply($tomi, GuestReply::Coming);
        $walkIn = Guest::walkedIn($this->event, 'Bayo Ige', 'bayo ige', $this->owner, self::now());
        self::em()->persist($walkIn);
        self::em()->flush();

        self::at('2026-11-06 08:00');
        self::runUntilIdle();

        self::assertStringContainsString("Not seated: 2\n", ($this->emails($this->ada)[0] ?? self::fail('No summary.'))->body, 'Bayo walked in unseated and is not counted.');

        self::at('2026-11-06 10:00');
        $this->seat($walkIn, $table, 1);
        $this->seat($tomi, $table, 2);
        $this->reply($this->guest('Femi Ojo'), GuestReply::NotComing);

        self::at('2026-11-07 08:00');
        self::runUntilIdle();

        self::assertStringContainsString("Not seated: 1\n", ($this->emails($this->ada)[1] ?? self::fail('No second summary.'))->body, 'Seating Tomi lowers it by one; seating Bayo changes nothing.');

        self::at('2026-11-07 10:00');
        $companions = self::service(GuestRepository::class)->findCompanionsOf($tomi);
        $this->seat($companions[0] ?? self::fail('No companion.'), $table, 3);
        $this->reply($this->guest('Sade Ola'), GuestReply::NotComing);

        self::at('2026-11-08 08:00');
        self::runUntilIdle();

        self::assertStringNotContainsString('Not seated', ($this->emails($this->ada)[2] ?? self::fail('No third summary.'))->body, 'A count of 0 is never shown.');
    }

    #[Test]
    public function noMealLineIsShownWithoutACourseThatAsksOrWhenEveryoneComingHasAnswered(): void
    {
        $same = $this->course('Dessert', false);
        self::at('2026-11-06 10:00');
        $tomi = $this->guest('Tomi Bello');
        $this->reply($tomi, GuestReply::Coming);

        self::at('2026-11-07 08:00');
        self::runUntilIdle();

        self::assertStringNotContainsString('No meal chosen', ($this->emails($this->ada)[0] ?? self::fail('No summary.'))->body, 'Everyone gets the same asks nothing.');

        $same->setGuestsChoose(true);
        $this->answer($tomi, $same, MealAnswerKind::Chosen);
        $kemi = $this->guest('Kemi Ade');
        self::at('2026-11-07 10:00');
        $this->reply($kemi, GuestReply::Coming);
        $this->answer($kemi, $same, MealAnswerKind::Chosen);

        self::at('2026-11-08 08:00');
        self::runUntilIdle();

        self::assertStringNotContainsString('No meal chosen', ($this->emails($this->ada)[1] ?? self::fail('No second summary.'))->body, 'A count of 0 is never shown.');
    }

    #[Test]
    public function anEventEightDaysAwayHasNoMealLine(): void
    {
        $this->course('Main');
        self::at('2026-11-03 10:00');
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);

        self::at('2026-11-04 08:00');
        self::runUntilIdle();

        self::assertStringNotContainsString('No meal chosen', ($this->emails($this->ada)[0] ?? self::fail('No summary.'))->body);
    }

    #[Test]
    public function peopleWithNoMealChosenSendNoSummaryWhenNothingIsUnread(): void
    {
        $this->course('Main');
        self::at('2026-11-06 10:00');
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);
        self::at('2026-11-06 10:01');
        $this->open($this->ada);

        self::at('2026-11-07 08:00');
        self::runUntilIdle();

        self::assertSame([], $this->emails($this->ada));
    }

    #[Test]
    public function aMutedEventGetsTheBellOnly(): void
    {
        self::service(EventMuter::class)->set($this->ada, $this->event, true);
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);
        self::at('2026-11-03 08:00');
        self::runUntilIdle();

        self::assertSame(['1 coming'], $this->titles($this->ada));
        self::assertSame([], $this->pushes($this->ada));
        self::assertSame([], $this->emails($this->ada));
    }

    #[Test]
    public function aMemberWhoLosesAccessStopsGettingItFromThen(): void
    {
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);
        self::connection()->executeStatement("UPDATE memberships SET status = 'suspended' WHERE user_id = :user", ['user' => $this->ada->getId()->toRfc4122()]);
        self::at('2026-11-02 10:10');
        $this->reply($this->guest('Kemi Ade'), GuestReply::Coming);
        self::at('2026-11-03 08:00');
        self::runUntilIdle();

        self::assertSame(['1 coming'], $this->titles($this->ada));
        self::assertSame([], $this->emails($this->ada));
    }

    #[Test]
    public function aMemberWhoLosesTheEventThatFirstQueuedTheirSummaryStillGetsItForTheEventsTheyKeep(): void
    {
        $bo = $this->member('bo', SeededRole::Member);
        $bo->setTimezone(self::ZONE);
        $dinner = $this->wedding('Dinner');
        $gala = $this->onEvent($bo, $this->event);
        $this->onEvent($bo, $dinner);
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);
        self::at('2026-11-02 10:10');
        $this->reply($this->guest('Kemi Ade', $dinner), GuestReply::Coming);
        self::em()->remove($gala);
        self::em()->flush();
        self::at('2026-11-03 08:00');
        self::runUntilIdle();

        $email = $this->emails($bo)[0] ?? self::fail('No summary.');
        self::assertSame('Dinner: 1 new reply', $email->subject);
        self::assertStringNotContainsString('Gala', $email->body);
        self::assertStringContainsString('Kemi Ade', $email->body);
    }

    #[Test]
    public function aReplyAHostRecordsForAGuestIsToldLikeTheGuestsOwn(): void
    {
        $guest = $this->guest('Tomi Bello');
        self::service(GuestAnswers::class)->answer($guest, GuestReply::Coming, recorded: new RecordedReply($this->owner, GuestReplyHow::Phone, false));
        self::runUntilIdle();

        self::assertSame(['1 coming'], $this->titles($this->ada));
        self::assertSame(['1 new reply · Gala'], $this->pushes($this->ada));
    }

    #[Test]
    public function aGuestsOwnNeedsChangeIsToldAndAHostsEditOfThemIsNot(): void
    {
        $tomi = $this->guest('Tomi Bello');
        $kemi = $this->guest('Kemi Ade');
        $this->reply($tomi, GuestReply::Coming);
        self::at('2026-11-02 10:01');
        $this->open($this->ada);
        self::at('2026-11-02 10:05');
        $this->reply($tomi, GuestReply::Coming, ['vegan']);
        $this->transaction(fn () => self::service(GuestNeedsRecord::class)->write($kemi, self::diet(['halal']), $this->owner));
        self::runUntilIdle();

        self::assertSame(['1 updated dietary needs', '1 coming'], $this->titles($this->ada), 'The same reply with new needs is a needs change, not a changed reply.');
        self::assertSame([[GuestChangeKind::Needs, 'Tomi Bello']], Vec\map($this->log()->unseen($this->ada->getId(), $this->eventId())->rows, static fn ($row): array => [$row->kind, $row->name]));
    }

    #[Test]
    public function aGuestWhoTellsUsTheirLinkReachedTheWrongPersonIsTold(): void
    {
        $guest = $this->guest('Tomi Bello');
        $this->flag($guest);
        $this->flag($guest);

        self::assertSame(['1 link may have reached the wrong person'], $this->titles($this->ada));
        self::assertSame(1, self::rowCount('SELECT COUNT(*) FROM guest_reply_changes WHERE guest_id = :guest', ['guest' => $guest->getId()->toRfc4122()]), 'A second tell changes nothing.');
    }

    #[Test]
    public function aDoubledJobSendsOnce(): void
    {
        $this->reply($this->guest('Tomi Bello'), GuestReply::Coming);
        $row = self::connection()->fetchAssociative("SELECT type, cancellation_key, source_id, payload FROM scheduled_notifications WHERE type = 'guest_replies.push'") ?: throw new LogicException('No push.');

        self::scheduler()->schedule(
            Type\string()->coerce($row['type']),
            Type\string()->coerce($row['cancellation_key']) . ':again',
            Type\string()->coerce($row['source_id']),
            Trigger::at(self::now()),
            Audience::membersOfEvent($this->organisation->getId(), $this->event->getId(), Permission::GuestsRead),
            Json\typed(Type\string()->coerce($row['payload']), Type\dict(Type\string(), Type\mixed())),
            $this->event,
        );
        self::runUntilIdle();

        self::assertSame(['1 new reply · Gala'], $this->pushes($this->ada));
    }

    #[Test]
    public function theUnsubscribeTokenNamesItsMemberAndNothingElse(): void
    {
        $unsubscribe = self::service(GuestRepliesUnsubscribe::class);
        $token = $unsubscribe->token($this->ada->getId());

        self::assertSame(44, Str\length($token));
        self::assertTrue($this->ada->getId()->equals($unsubscribe->memberOf($token)));
        self::assertNull($unsubscribe->memberOf(Str\slice($token, 0, 43) . ('A' === Str\slice($token, 43) ? 'B' : 'A')));
        self::assertNull($unsubscribe->memberOf(Str\slice($unsubscribe->token($this->owner->getId()), 0, 22) . Str\slice($token, 22)));
        self::assertSame(GuestRepliesSummary::NAME, 'guest_replies.summary');
    }

    private function wedding(string $name = 'Gala'): Event
    {
        $starts = new DateTimeImmutable('2026-11-12 18:00', new DateTimeZone(self::ZONE));
        $event = new Event($this->organisation, $name, EventType::Wedding, $starts, $starts->modify('+5 hours'), 'NGN');
        $event->makeLive(self::now());
        self::em()->persist($event);
        self::em()->flush();

        return $event;
    }

    private function course(string $name, bool $guestsChoose = true): MenuCourse
    {
        $course = new MenuCourse($this->event, $name, null, 0);
        $course->setGuestsChoose($guestsChoose);
        self::em()->persist($course);
        self::em()->persist(new MenuDish($course, null, $name . ' one', null, [], [], 0));
        self::em()->persist(new MenuDish($course, null, $name . ' two', null, [], [], 1));
        self::em()->flush();

        return $course;
    }

    private function companion(Guest $host, string $name): void
    {
        self::em()->persist(Guest::companionOf($host, $name, Str\lowercase($name), 1, null));
        self::em()->flush();
    }

    private function answer(Guest $person, MenuCourse $course, MealAnswerKind $kind): void
    {
        $dish = MealAnswerKind::Chosen === $kind ? self::em()->getRepository(MenuDish::class)->findOneBy(['course' => $course]) : null;
        self::em()->persist(new MealAnswer($person, $course, $kind, $dish, null, [], []));
        self::em()->flush();
    }

    private function seatingPlan(): SeatingTable
    {
        $plan = new SeatingPlan($this->event, null, 1000, 1000, null);
        $table = new SeatingTable($plan, 'Table 1', 'table 1', TableShape::Round, 100, 100, null);
        self::em()->persist($plan);
        self::em()->persist($table);
        self::em()->flush();

        return $table;
    }

    private function seat(Guest $person, SeatingTable $table, int $seat): void
    {
        self::em()->persist(new SeatAssignment($person, $table, $seat));
        self::em()->flush();
    }

    /**
     * From the guest's own page: Coming again, each named companion Coming or Not coming.
     *
     * @param array<string, bool> $coming by companion name
     */
    private function companionsComing(Guest $guest, array $coming): void
    {
        $choices = Vec\map(
            self::service(GuestRepository::class)->findCompanionsOf($guest),
            static fn (Guest $companion): CompanionChoice => new CompanionChoice($companion->getId()->toRfc4122(), $companion->getFullName() ?? '', Str\lowercase($companion->getFullName() ?? ''), $coming[$companion->getFullName() ?? ''] ?? true),
        );
        self::service(GuestAnswers::class)->answer($guest, GuestReply::Coming, new PageReply($choices, null));
        self::runUntilIdle();
    }

    private function onEvent(User $user, Event $event): EventPerson
    {
        $membership = self::em()->getRepository(Membership::class)->findOneBy(['user' => $user, 'organisation' => $this->organisation]) ?? self::fail('Not a member.');
        $person = new EventPerson($event, $membership, EventRole::CanView, null);
        self::em()->persist($person);
        self::em()->flush();

        return $person;
    }

    private function guest(string $name, ?Event $event = null): Guest
    {
        $guest = Guest::listed($event ?? $this->event, $name, Str\lowercase($name), null, null, null, Str\pad_right(Str\replace(Uuid::v4()->toBase58(), '1', 'x'), 43, 'a'));
        $guest->invite(GuestInvitationMethod::InPerson, self::now(), null);
        self::em()->persist($guest);
        self::em()->flush();

        return $guest;
    }

    /**
     * From the guest's own page, as a guest sends it.
     *
     * @param list<string>|null $diet sent with Coming
     */
    private function reply(Guest $guest, GuestReply $answer, ?array $diet = null): void
    {
        self::service(GuestAnswers::class)->answer($guest, $answer, new PageReply([], null === $diet ? null : self::diet($diet)));
        self::runUntilIdle();
    }

    /** @param list<string> $diet */
    private function needs(Guest $guest, array $diet): void
    {
        $this->transaction(static fn () => self::service(GuestNeedsRecord::class)->write($guest, self::diet($diet), null));
        self::runUntilIdle();
    }

    private function flag(Guest $guest): void
    {
        self::service(InvitationLinks::class)->flag($guest);
        self::runUntilIdle();
    }

    /** @param list<string> $codes */
    private static function diet(array $codes): GuestNeeds
    {
        $none = GuestNeeds::none();

        return new GuestNeeds([...$none->codes, NeedKind::Diet->value => $codes], $none->others, null);
    }

    private function transaction(callable $change): void
    {
        self::em()->wrapInTransaction($change);
    }

    private function open(User $user): void
    {
        $item = self::em()->getRepository(NotificationItem::class)->findOneBy(['user' => $user, 'thread' => GuestReplyLog::thread($this->eventId()), 'readAt' => null]) ?? self::fail('No unread item.');
        self::service(NotificationReadMarker::class)->markRead($user, $item);
    }

    private function readAll(User $user): void
    {
        self::service(NotificationReadMarker::class)->markAllRead($user);
    }

    private function log(): GuestReplyLog
    {
        return self::service(GuestReplyLog::class);
    }

    private function eventId(): string
    {
        return $this->event->getId()->toRfc4122();
    }

    /** @return list<string> newest first */
    private function titles(User $user): array
    {
        return Vec\map(
            self::connection()->fetchFirstColumn("SELECT title FROM notification_items WHERE user_id = :user AND category = 'guest_replies' ORDER BY created_at DESC, id DESC", ['user' => $user->getId()->toRfc4122()]),
            static fn (mixed $title): string => Type\string()->coerce($title),
        );
    }

    private function place(User $user): string
    {
        return Type\string()->coerce(self::scalar("SELECT place FROM notification_items WHERE user_id = :user AND category = 'guest_replies' AND read_at IS NULL", ['user' => $user->getId()->toRfc4122()]));
    }

    /** @return list<RenderedNotification> */
    private function emails(User $user): array
    {
        return Vec\values(Vec\map(
            Vec\filter(self::sender()->sent, static fn (array $sent): bool => $sent['recipient']->id->equals($user->getId())),
            static fn (array $sent): RenderedNotification => $sent['notification'],
        ));
    }

    /** @return list<string> */
    private function pushes(User $user): array
    {
        return Vec\values(Vec\map(
            Vec\filter(self::service(RecordingPushSender::class)->sent, static fn (array $sent): bool => $sent['recipient']->id->equals($user->getId())),
            static fn (array $sent): string => $sent['notification']->body,
        ));
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
