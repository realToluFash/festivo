<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\EventMuter;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\PathSymptom;
use App\Domain\Messaging\Model\Trigger;
use App\Domain\Messaging\NotificationPathCheck;
use App\Domain\Messaging\NotificationPreferenceSetter;
use App\Entity\Event;
use App\Entity\Membership;
use App\Entity\User;
use App\Enum\MembershipStatus;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\SeededRole;
use App\Tests\Double\Messaging\RecordingPushSender;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Types\Types;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** Epic 36 §5 through the worker: a push due between 21:00 and 08:00 in the member's zone waits for 08:00, unless it is Event day (sc-20494). */
final class QuietHoursTest extends MessagingTestCase
{
    use ClockSensitiveTrait;

    private const string ZONE = 'Africa/Lagos';

    private User $member;

    protected function setUp(): void
    {
        parent::setUp();
        $this->member = $this->member('ada', SeededRole::Administrator);
        $this->member->setTimezone(self::ZONE);
        self::em()->flush();
    }

    /** @return iterable<string, array{string, bool}> */
    public static function dueTimes(): iterable
    {
        yield '20:59 goes at once' => ['20:59', true];
        yield '21:00 waits' => ['21:00', false];
        yield '07:59 waits' => ['07:59', false];
        yield '08:00 goes at once' => ['08:00', true];
    }

    #[Test]
    #[DataProvider('dueTimes')]
    public function aPushWaitsFrom2100UntilJustBefore0800(string $dueAt, bool $goesAtOnce): void
    {
        self::at("2026-10-29 {$dueAt}");
        $this->schedule('test.push.money', 'bill');

        self::runUntilIdle();

        self::assertSame(1, self::itemCount(), 'The bell item waited with the push.');
        self::assertCount($goesAtOnce ? 1 : 0, self::pushes()->sent);
    }

    /** @return iterable<string, array{string}> */
    public static function heldTypes(): iterable
    {
        yield 'Guest replies' => ['test.push.guest_replies'];
        yield 'Messages' => ['test.push.messages'];
        yield 'Event changes' => ['test.push.event_changes'];
        yield 'Money' => ['test.push.money'];
        yield 'Account & security' => ['test.push.account_security'];
    }

    #[Test]
    #[DataProvider('heldTypes')]
    public function everyCategoryButEventDayWaitsForTheMorning(string $type): void
    {
        self::service(NotificationPreferenceSetter::class)->set($this->member, NotificationCategory::AccountSecurity, NotificationChannel::Push, true);
        self::at('2026-10-29 23:00');
        $this->schedule($type, 'night');
        self::runUntilIdle();

        self::assertSame([], self::pushes()->sent);
        self::assertSame('quiet_hours', self::scalar("SELECT held FROM notification_deliveries WHERE channel = 'push'"));

        self::at('2026-10-30 08:00');
        self::runUntilIdle();

        self::assertCount(1, self::pushes()->sent);
    }

    #[Test]
    public function anEventDayPushGoesAtAnyHour(): void
    {
        self::at('2026-10-29 23:00');
        $this->schedule('test.push.event_day', 'doors');

        self::runUntilIdle();

        self::assertSame([NotificationCategory::EventDay], Vec\map(self::pushes()->sent, static fn (array $sent): NotificationCategory => $sent['category']));
    }

    #[Test]
    public function aHeldPushGoesAt0800AsItsItemThenReads(): void
    {
        $this->holdOvernight('test.push.money', 'bill', ['line' => 'The florist is due']);
        self::connection()->executeStatement('UPDATE scheduled_notifications SET payload = :payload', ['payload' => Json\encode(['line' => 'The florist and the band are due'])]);

        self::at('2026-10-30 08:00');
        self::runUntilIdle();

        self::assertSame(['The florist and the band are due'], Vec\map(self::pushes()->sent, static fn (array $sent): string => $sent['notification']->body));
        self::assertSame('sent', self::scalar("SELECT status FROM notification_deliveries WHERE channel = 'push'"));
    }

    #[Test]
    public function aHeldPushWhoseItemWasReadSendsNothing(): void
    {
        $this->holdOvernight('test.push.money', 'bill');
        self::connection()->executeStatement('UPDATE notification_items SET read_at = :at', ['at' => '2026-10-29 23:30:00+01']);

        $this->assertNothingAt0800('its item was read');
    }

    #[Test]
    public function aHeldPushWhoseItemHasGoneSendsNothing(): void
    {
        $this->holdOvernight('test.push.event_changes', 'change');
        self::connection()->executeStatement('DELETE FROM notification_items');

        $this->assertNothingAt0800('its item has gone');
    }

    #[Test]
    public function heldPushesForOneItemGoAsOne(): void
    {
        self::at('2026-10-29 23:00');
        $this->schedule('test.push.collapsing', 'reply:1', ['line' => 'Bola is going']);
        self::at('2026-10-29 23:40');
        $this->schedule('test.push.collapsing', 'reply:2', ['line' => 'Chidi is going']);
        self::runUntilIdle();

        self::at('2026-10-30 08:00');
        self::runUntilIdle();

        self::assertSame(["Bola is going\nChidi is going"], Vec\map(self::pushes()->sent, static fn (array $sent): string => $sent['notification']->body));
    }

    #[Test]
    public function theReleaseRunTwiceSendsOnce(): void
    {
        $this->holdOvernight('test.push.money', 'bill');

        self::at('2026-10-30 08:00');
        self::runUntilIdle();
        self::runUntilIdle();
        self::at('2026-10-30 08:05');
        self::runUntilIdle();

        self::assertCount(1, self::pushes()->sent);
        self::assertSame('sent', self::scalar("SELECT status FROM notification_deliveries WHERE channel = 'push'"));
    }

    #[Test]
    public function aSecondWorkerLeavesTheReleaseToTheWorkerThatClaimedIt(): void
    {
        $this->holdOvernight('test.push.money', 'bill');

        self::at('2026-10-30 08:00');
        self::connection()->executeStatement(
            "UPDATE notification_deliveries SET claimed_at = :now, claimed_until = :lease WHERE channel = 'push'",
            ['now' => self::now(), 'lease' => self::now()->modify('+60 seconds')],
            ['now' => Types::DATETIME_IMMUTABLE, 'lease' => Types::DATETIME_IMMUTABLE],
        );
        self::runUntilIdle();

        self::assertSame([], self::pushes()->sent);
        self::assertSame('pending', self::scalar("SELECT status FROM notification_deliveries WHERE channel = 'push'"));

        self::at('2026-10-30 08:01:01');
        self::runUntilIdle();
        self::runUntilIdle();

        self::assertCount(1, self::pushes()->sent);
    }

    #[Test]
    public function heldPushesForOneItemReleasedTwiceGoAsOne(): void
    {
        self::at('2026-10-29 23:00');
        $this->schedule('test.push.collapsing', 'reply:1', ['line' => 'Bola is going']);
        $this->schedule('test.push.collapsing', 'reply:2', ['line' => 'Chidi is going']);
        self::runUntilIdle();

        self::at('2026-10-30 08:00');
        self::runUntilIdle();
        self::runUntilIdle();

        self::assertCount(1, self::pushes()->sent);
    }

    #[Test]
    public function aPushSwitchedOffInTheNightSendsNothing(): void
    {
        $this->holdOvernight('test.push.money', 'bill');
        self::service(NotificationPreferenceSetter::class)->set($this->member, NotificationCategory::Money, NotificationChannel::Push, false);

        $this->assertNothingAt0800('push switched off');
    }

    #[Test]
    public function anEventMutedInTheNightSendsNothing(): void
    {
        $event = $this->event();
        $this->holdOvernight('test.push.event_changes', 'change', [], $event);
        self::service(EventMuter::class)->set($this->member, $event, true);

        $this->assertNothingAt0800('event muted');
    }

    #[Test]
    public function aMemberWhoLostAccessInTheNightIsSentNothing(): void
    {
        $this->holdOvernight('test.push.money', 'bill');
        $membership = self::em()->getRepository(Membership::class)->findOneBy(['user' => $this->member]) ?? self::fail('no membership');
        $membership->setStatus(MembershipStatus::LeftOrRemoved, new DateTimeImmutable());
        self::em()->flush();

        $this->assertNothingAt0800('no longer in the audience');
    }

    #[Test]
    public function aHeldPushWhoseLimitPassesInTheNightIsRecordedTooLate(): void
    {
        $this->holdOvernight('test.push.timely', 'reminder');

        self::at('2026-10-30 01:00:01');
        self::runUntilIdle();

        self::assertSame([], self::pushes()->sent);
        self::assertSame('too_late', self::scalar("SELECT status FROM notification_deliveries WHERE channel = 'push'"));
    }

    #[Test]
    public function anAccountWithNoZoneHasItsNightInUtc(): void
    {
        $this->member->setTimezone(null);
        self::em()->flush();
        self::mockTime(new DateTimeImmutable('2026-10-29 21:30', new DateTimeZone('UTC')));
        $this->schedule('test.push.money', 'bill');
        self::runUntilIdle();

        self::assertSame([], self::pushes()->sent);

        self::mockTime(new DateTimeImmutable('2026-10-30 08:00', new DateTimeZone('UTC')));
        self::runUntilIdle();

        self::assertCount(1, self::pushes()->sent);
    }

    #[Test]
    public function aZoneChangedToAnotherNightWaitsForThatZonesMorning(): void
    {
        $this->holdOvernight('test.push.money', 'bill');

        $this->member->setTimezone('Asia/Tokyo');
        self::em()->flush();
        self::runUntilIdle();

        self::assertSame([], self::pushes()->sent);
        self::assertSame('2026-10-29 23:00:00', self::scalar("SELECT to_char(next_attempt_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') FROM notification_deliveries WHERE channel = 'push'"));
    }

    #[Test]
    public function aZoneChangedIntoTheDayGetsTheHeldPushAtOnce(): void
    {
        $this->holdOvernight('test.push.money', 'bill');

        $this->member->setTimezone('America/New_York');
        self::em()->flush();
        self::runUntilIdle();

        self::assertCount(1, self::pushes()->sent);
    }

    #[Test]
    public function anItemThatBecomesEventDayPushesAtOnceAndTheHeldPushIsDropped(): void
    {
        $this->holdOvernight('test.push.event_changes', 'change');

        $this->schedule('test.push.event_day', 'change');
        self::runUntilIdle();

        self::assertSame([NotificationCategory::EventDay], Vec\map(self::pushes()->sent, static fn (array $sent): NotificationCategory => $sent['category']));

        self::at('2026-10-30 08:00');
        self::runUntilIdle();

        self::assertCount(1, self::pushes()->sent);
    }

    #[Test]
    public function thePathCheckCountsAHeldPushAsWaitingOnlyFrom0800(): void
    {
        $this->holdOvernight('test.push.money', 'bill');

        self::at('2026-10-30 07:59');
        self::assertSame([], self::service(NotificationPathCheck::class)->run());

        self::at('2026-10-30 08:31');
        self::assertSame([PathSymptom::Stopped, PathSymptom::Behind], self::service(NotificationPathCheck::class)->run());
    }

    #[Test]
    public function aZoneChangeLeavesAPushAnotherWorkerHoldsToThatWorker(): void
    {
        $this->holdOvernight('test.push.money', 'bill');

        self::at('2026-10-30 06:30');
        self::connection()->executeStatement(
            "UPDATE notification_deliveries SET claimed_at = :now, claimed_until = :lease WHERE channel = 'push'",
            ['now' => self::now(), 'lease' => self::now()->modify('+60 seconds')],
            ['now' => Types::DATETIME_IMMUTABLE, 'lease' => Types::DATETIME_IMMUTABLE],
        );
        $this->member->setTimezone('Asia/Tokyo');
        self::em()->flush();
        self::runUntilIdle();

        self::assertSame([], self::pushes()->sent);
        self::assertSame('pending', self::scalar("SELECT status FROM notification_deliveries WHERE channel = 'push'"));
    }

    #[Test]
    public function aHeldPushWhoseItemWasReadWhileTheEventWasPausedSendsNothing(): void
    {
        $event = $this->event();
        $this->holdOvernight('test.push.event_changes', 'change', [], $event);

        self::at('2026-10-30 07:30');
        self::connection()->executeStatement("UPDATE events SET status = 'paused' WHERE id = :id", ['id' => $event->getId()->toRfc4122()]);
        self::at('2026-10-30 08:00');
        self::runUntilIdle();
        self::assertSame('paused', self::scalar("SELECT held FROM notification_deliveries WHERE channel = 'push'"));

        self::connection()->executeStatement('UPDATE notification_items SET read_at = :at', ['at' => '2026-10-30 08:15:00+01']);
        self::connection()->executeStatement("UPDATE events SET status = 'live' WHERE id = :id", ['id' => $event->getId()->toRfc4122()]);

        $this->assertNothingAt('2026-10-30 09:00', 'its item was read');
    }

    #[Test]
    public function aPushLeftAsTheOnlyWayToHearSendsNothing(): void
    {
        $this->holdOvernight('test.push.email_money', 'bill', [], null, 0);
        self::service(NotificationPreferenceSetter::class)->set($this->member, NotificationCategory::Money, NotificationChannel::Email, false);

        $this->assertNothingAt0800('push would be the only way they hear');
    }

    /** @param array<string, mixed> $payload */
    private function holdOvernight(string $type, string $key, array $payload = [], ?Event $event = null, int $items = 1): void
    {
        self::at('2026-10-29 23:00');
        $this->schedule($type, $key, $payload, $event);
        self::runUntilIdle();

        self::assertSame($items, self::itemCount());
        self::assertSame([], self::pushes()->sent);
    }

    private function assertNothingAt0800(string $why): void
    {
        $this->assertNothingAt('2026-10-30 08:00', $why);
    }

    private function assertNothingAt(string $localTime, string $why): void
    {
        self::at($localTime);
        self::runUntilIdle();

        self::assertSame([], self::pushes()->sent);
        self::assertSame(['cancelled', $why], self::connection()->fetchNumeric("SELECT status, last_error FROM notification_deliveries WHERE channel = 'push'"));
    }

    /** @param array<string, mixed> $payload */
    private function schedule(string $type, string $key, array $payload = [], ?Event $event = null): void
    {
        self::scheduler()->schedule($type, $key, $type . ':' . $key, Trigger::at(self::now()), Audience::members($this->organisation->getId(), [$this->member->getId()]), $payload, $event);
    }

    private static function at(string $localTime): void
    {
        self::mockTime(new DateTimeImmutable($localTime, new DateTimeZone(self::ZONE)));
    }

    private static function now(): DateTimeImmutable
    {
        return self::service(ClockInterface::class)->now();
    }

    private static function itemCount(): int
    {
        return self::rowCount('SELECT COUNT(*) FROM notification_items');
    }

    private static function pushes(): RecordingPushSender
    {
        return self::service(RecordingPushSender::class);
    }
}
