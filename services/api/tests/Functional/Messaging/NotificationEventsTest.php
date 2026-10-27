<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Event\EventEditor;
use App\Domain\Event\EventTimesRecomputer;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\EventAnchor;
use App\Domain\Messaging\Model\Trigger;
use App\Entity\Event;
use App\Enum\Permission;
use App\Http\EntityTag;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Type;
use Psl\Vec;

final class NotificationEventsTest extends MessagingTestCase
{
    #[Test]
    public function aNewEventDateMovesWhatCountsFromTheEventAndNothingElse(): void
    {
        $event = $this->event('+10 days');
        self::scheduler()->schedule('test.notice', 'day-before', 'day-before', Trigger::relativeToEvent(EventAnchor::EventStart, '-P1D', '10:00'), $this->members(), [], $event);
        self::scheduler()->schedule('test.notice', 'payment', 'payment', Trigger::relativeTo('2026-11-20', '-P3D', '10:00'), $this->members(), [], $event);
        $before = $this->dueAt('day-before');
        $payment = $this->dueAt('payment');

        $starts = $event->getStartsAt()->modify('+2 days');
        self::service(EventEditor::class)->edit($event, EntityTag::of($event->getVersion()), $this->owner, [
            'startsAt' => $starts->format('Y-m-d\TH:i:s'),
            'endsAt' => $starts->modify('+5 hours')->format('Y-m-d\TH:i:s'),
        ]);

        self::assertSame(2 * 86400, $this->dueAt('day-before')->getTimestamp() - $before->getTimestamp());
        self::assertSame('10:00', $this->dueAt('day-before')->setTimezone(new DateTimeZone('Africa/Lagos'))->format('H:i'));
        self::assertEquals($payment, $this->dueAt('payment'));
        self::assertSame(2, self::rowCount("SELECT COUNT(*) FROM scheduled_notifications WHERE status = 'pending'"));
    }

    #[Test]
    public function aNewZoneAloneMovesWhatCountsFromTheEvent(): void
    {
        $event = $this->event('+10 days');
        self::scheduler()->schedule('test.notice', 'day-before', 'day-before', Trigger::relativeToEvent(EventAnchor::EventStart, '-P1D', '10:00'), $this->members(), [], $event);
        $before = $this->dueAt('day-before');

        self::service(EventEditor::class)->edit($event, EntityTag::of($event->getVersion()), $this->owner, ['timeZone' => 'Asia/Tokyo']);

        self::assertSame('18:00', $event->getStartsAt()->format('H:i'));
        self::assertSame(-8 * 3600, $this->dueAt('day-before')->getTimestamp() - $before->getTimestamp());
        self::assertSame('10:00', $this->dueAt('day-before')->setTimezone(new DateTimeZone('Asia/Tokyo'))->format('H:i'));
    }

    #[Test]
    #[DataProvider('newZones')]
    public function aNewZoneReadsACallersDayOnTheNewClock(string $zone, string $due): void
    {
        $event = $this->event('+10 days');
        self::scheduler()->schedule('test.timely', 'payment', 'payment', Trigger::relativeTo('2026-11-20', '-P3D', '10:00'), $this->members(), [], $event);
        self::assertSame('2026-11-17 09:00', $this->dueAt('payment')->format('Y-m-d H:i'));

        self::service(EventEditor::class)->edit($event, EntityTag::of($event->getVersion()), $this->owner, ['timeZone' => $zone]);

        self::assertSame($due, $this->dueAt('payment')->format('Y-m-d H:i'));
        self::assertSame('2026-11-17 10:00', $this->dueAt('payment')->setTimezone(new DateTimeZone($zone))->format('Y-m-d H:i'));
        self::assertSame(3600, $this->sendBy('payment')->getTimestamp() - $this->dueAt('payment')->getTimestamp());
        self::assertSame(1, self::rowCount("SELECT COUNT(*) FROM scheduled_notifications WHERE status = 'pending'"));
    }

    /** @return iterable<string, array{string, string}> */
    public static function newZones(): iterable
    {
        yield 'east of Lagos' => ['Asia/Tokyo', '2026-11-17 01:00'];
        yield 'west, where Lagos midnight is still the day before' => ['America/Los_Angeles', '2026-11-17 18:00'];
    }

    #[Test]
    public function aNewZoneLeavesAnExactMomentAndARowWithNoEventWhereTheyWere(): void
    {
        $event = $this->event('+10 days');
        self::scheduler()->schedule('test.notice', 'moment', 'moment', Trigger::at(new DateTimeImmutable('2026-11-17 09:00', new DateTimeZone('UTC'))), $this->members(), [], $event);
        self::scheduler()->schedule('test.notice', 'no-event', 'no-event', Trigger::relativeTo('2026-11-20', '-P3D', '10:00'), $this->members());

        self::service(EventEditor::class)->edit($event, EntityTag::of($event->getVersion()), $this->owner, ['timeZone' => 'Asia/Tokyo']);

        self::assertSame('2026-11-17 09:00', $this->dueAt('moment')->format('Y-m-d H:i'));
        self::assertSame('2026-11-17 10:00', $this->dueAt('no-event')->format('Y-m-d H:i'));
    }

    #[Test]
    public function recomputingAnEventsTimesMovesWhatCountsFromIt(): void
    {
        $event = $this->event('+10 days');
        self::scheduler()->schedule('test.notice', 'day-before', 'day-before', Trigger::relativeToEvent(EventAnchor::EventStart, '-P1D', '10:00'), $this->members(), [], $event);
        self::scheduler()->schedule('test.notice', 'payment', 'payment', Trigger::relativeTo('2026-11-20', '-P3D', '10:00'), $this->members(), [], $event);
        $id = ['id' => $event->getId()->toRfc4122()];
        self::connection()->executeStatement("UPDATE events SET starts_at_utc = starts_at_utc - INTERVAL '3 hours', ends_at_utc = ends_at_utc - INTERVAL '3 hours' WHERE id = :id", $id);
        self::connection()->executeStatement("UPDATE scheduled_notifications SET due_at = due_at - INTERVAL '3 hours' WHERE event_id = :id", $id);
        self::em()->clear();

        self::assertSame(1, self::service(EventTimesRecomputer::class)->recompute());

        self::assertSame('10:00', $this->dueAt('day-before')->setTimezone(new DateTimeZone('Africa/Lagos'))->format('H:i'));
        self::assertSame('2026-11-17 09:00', $this->dueAt('payment')->format('Y-m-d H:i'));
        self::assertSame(2, self::rowCount("SELECT COUNT(*) FROM scheduled_notifications WHERE status = 'pending'"));
    }

    #[Test]
    public function aPausedEventHoldsAutomaticSendsUntilItResumes(): void
    {
        $event = $this->event();
        self::connection()->executeStatement("UPDATE events SET status = 'paused' WHERE id = :id", ['id' => $event->getId()->toRfc4122()]);
        self::scheduler()->schedule('test.notice', 'held', 'held', Trigger::at(new DateTimeImmutable('-1 minute')), $this->members(), [], $event);

        self::runUntilIdle();
        self::assertSame([], self::sender()->sent);
        self::assertSame('paused', self::scalar('SELECT held FROM notification_deliveries'));

        self::connection()->executeStatement("UPDATE events SET status = 'live' WHERE id = :id", ['id' => $event->getId()->toRfc4122()]);
        self::connection()->executeStatement("UPDATE notification_deliveries SET next_attempt_at = NOW() - INTERVAL '2 seconds'");
        self::runUntilIdle();

        self::assertSame(['OWNER'], self::sentTo());
        self::assertNull(self::scalar('SELECT held FROM notification_deliveries'));
    }

    #[Test]
    public function aHostMessageGoesWhileTheEventIsPaused(): void
    {
        $event = $this->event();
        self::connection()->executeStatement("UPDATE events SET status = 'paused' WHERE id = :id", ['id' => $event->getId()->toRfc4122()]);
        self::scheduler()->schedule('test.host_message', 'why', 'why', Trigger::at(new DateTimeImmutable('-1 minute')), $this->members(), [], $event);

        self::runUntilIdle();

        self::assertSame(['OWNER'], self::sentTo());
    }

    #[Test]
    public function aDeletedEventsRowWaitsWhileItsDeletionNoticeGoes(): void
    {
        $event = $this->event();
        self::scheduler()->schedule('test.notice', 'held', 'held', Trigger::at(new DateTimeImmutable('-1 minute')), $this->members(), [], $event);
        self::scheduler()->schedule('test.deletion', 'deleted', 'deleted', Trigger::at(new DateTimeImmutable('-1 minute')), $this->members(), [], $event);
        $this->deleteEvent($event);

        self::runUntilIdle();

        self::assertSame(['test.deletion'], Vec\map(self::sender()->sent, static fn (array $sent): string => $sent['notification']->subject));
        self::assertSame(['pending', 'deleted'], self::connection()->fetchNumeric("SELECT status, held FROM scheduled_notifications WHERE type = 'test.notice'"));
        self::assertSame(0, self::rowCount("SELECT COUNT(*) FROM notification_deliveries WHERE type = 'test.notice'"));
    }

    #[Test]
    public function aDeletedEventsHeldRowIsSentOnceItIsRestored(): void
    {
        $event = $this->event();
        self::scheduler()->schedule('test.notice', 'held', 'held', Trigger::at(new DateTimeImmutable('-1 minute')), $this->members(), [], $event);
        $this->deleteEvent($event);
        self::runUntilIdle();

        self::connection()->executeStatement('UPDATE events SET deleted_at = NULL WHERE id = :id', ['id' => $event->getId()->toRfc4122()]);
        self::aMinutePasses();
        self::runUntilIdle();

        self::assertSame(['OWNER'], self::sentTo());
        self::assertSame(['fanned_out', null], self::connection()->fetchNumeric('SELECT status, held FROM scheduled_notifications'));
    }

    #[Test]
    public function aHeldRowRestoredPastItsTypesLimitIsRecordedTooLate(): void
    {
        $event = $this->event();
        self::scheduler()->schedule('test.timely', 'held', 'held', Trigger::at(new DateTimeImmutable('-1 minute')), $this->members(), [], $event);
        $this->deleteEvent($event);
        self::runUntilIdle();

        self::connection()->executeStatement("UPDATE scheduled_notifications SET send_by = NOW() - INTERVAL '2 seconds'");
        self::connection()->executeStatement('UPDATE events SET deleted_at = NULL WHERE id = :id', ['id' => $event->getId()->toRfc4122()]);
        self::aMinutePasses();
        self::runUntilIdle();

        self::assertSame([], self::sender()->sent);
        self::assertSame(['too_late', null], self::connection()->fetchNumeric('SELECT status, held FROM scheduled_notifications'));
    }

    #[Test]
    public function aRowForAnOrganisationsMembersGoesOnceTheOrganisationIsRestored(): void
    {
        $event = $this->event();
        $organisation = ['id' => $this->organisation->getId()->toRfc4122()];
        self::scheduler()->schedule('test.notice', 'members', 'members', Trigger::at(new DateTimeImmutable('-1 minute')), $this->members(), [], $event);
        self::connection()->executeStatement('UPDATE organisations SET deleted_at = NOW() WHERE id = :id', $organisation);
        self::runUntilIdle();
        self::assertSame([], self::sender()->sent);

        self::connection()->executeStatement('UPDATE organisations SET deleted_at = NULL WHERE id = :id', $organisation);
        self::aMinutePasses();
        self::runUntilIdle();

        self::assertSame(['OWNER'], self::sentTo());
    }

    #[Test]
    public function aFinishedEventsAutomaticRowIsCancelledNotHeldOnceItIsDeleted(): void
    {
        $event = $this->event('-2 days');
        self::connection()->executeStatement("UPDATE events SET status = 'ended' WHERE id = :id", ['id' => $event->getId()->toRfc4122()]);
        self::scheduler()->schedule('test.notice', 'late', 'late', Trigger::at(new DateTimeImmutable('-1 minute')), $this->members(), [], $event);
        $this->deleteEvent($event);

        self::runUntilIdle();

        self::assertSame(['cancelled', null], self::connection()->fetchNumeric('SELECT status, held FROM scheduled_notifications'));
    }

    #[Test]
    public function aDeliveryWaitingWhenItsEventIsDeletedIsHeldForTheRestore(): void
    {
        $event = $this->event();
        self::scheduler()->schedule('test.notice', 'fanned', 'fanned', Trigger::at(new DateTimeImmutable('-1 minute')), $this->members(), [], $event);
        self::worker()->step();
        $this->deleteEvent($event);

        self::runUntilIdle();
        self::assertSame(['pending', 'deleted'], self::connection()->fetchNumeric('SELECT status, held FROM notification_deliveries'));

        self::connection()->executeStatement('UPDATE events SET deleted_at = NULL WHERE id = :id', ['id' => $event->getId()->toRfc4122()]);
        self::aMinutePasses();
        self::runUntilIdle();

        self::assertSame(['OWNER'], self::sentTo());
    }

    #[Test]
    public function anEventsRowsGoWithItWhenItIsPurged(): void
    {
        $event = $this->event();
        self::scheduler()->schedule('test.notice', 'purged', 'purged', Trigger::at(new DateTimeImmutable('-1 minute')), $this->members(), [], $event);
        self::worker()->step();

        self::connection()->executeStatement('DELETE FROM events WHERE id = :id', ['id' => $event->getId()->toRfc4122()]);

        self::assertSame(0, self::rowCount('SELECT COUNT(*) FROM scheduled_notifications'));
        self::assertSame(0, self::rowCount('SELECT COUNT(*) FROM notification_deliveries'));
    }

    private function deleteEvent(Event $event): void
    {
        self::connection()->executeStatement('UPDATE events SET deleted_at = NOW() WHERE id = :id', ['id' => $event->getId()->toRfc4122()]);
    }

    /** The worker's hold recheck, without waiting for it. */
    private static function aMinutePasses(): void
    {
        self::connection()->executeStatement("UPDATE scheduled_notifications SET claimed_until = NOW() - INTERVAL '2 seconds' WHERE claimed_until IS NOT NULL");
        self::connection()->executeStatement("UPDATE notification_deliveries SET next_attempt_at = NOW() - INTERVAL '2 seconds' WHERE held IS NOT NULL");
    }

    private function members(): Audience
    {
        return Audience::membersWithPermission($this->organisation->getId(), Permission::BillingManage);
    }

    private function sendBy(string $key): DateTimeImmutable
    {
        return new DateTimeImmutable(
            Type\string()->coerce(self::scalar("SELECT send_by FROM scheduled_notifications WHERE cancellation_key = :key AND status = 'pending'", ['key' => $key])),
            new DateTimeZone('UTC'),
        );
    }

    private function dueAt(string $key): DateTimeImmutable
    {
        return new DateTimeImmutable(
            Type\string()->coerce(self::scalar("SELECT due_at FROM scheduled_notifications WHERE cancellation_key = :key AND status = 'pending'", ['key' => $key])),
            new DateTimeZone('UTC'),
        );
    }
}
