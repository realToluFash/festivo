<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Event\EventEditor;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\EventAnchor;
use App\Domain\Messaging\Model\Trigger;
use App\Enum\Permission;
use App\Http\EntityTag;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\Test;
use Psl\Type;

final class NotificationEventsTest extends MessagingTestCase
{
    #[Test]
    public function aNewEventDateMovesWhatCountsFromTheEventAndNothingElse(): void
    {
        $event = $this->event('+10 days');
        $paymentDue = new DateTimeImmutable('+20 days');
        self::scheduler()->schedule('test.notice', 'day-before', 'day-before', Trigger::relativeToEvent(EventAnchor::EventStart, '-P1D', '10:00'), $this->members(), [], $event);
        self::scheduler()->schedule('test.notice', 'payment', 'payment', Trigger::relativeTo($paymentDue, '-P3D'), $this->members(), [], $event);
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
    public function nothingAutomaticGoesForAnEventWhoseOrganisationIsDeleted(): void
    {
        $event = $this->event();
        self::scheduler()->schedule('test.notice', 'gone', 'gone', Trigger::at(new DateTimeImmutable('-1 minute')), $this->members(), [], $event);
        self::connection()->executeStatement('UPDATE organisations SET deleted_at = NOW() WHERE id = :id', ['id' => $this->organisation->getId()->toRfc4122()]);

        self::runUntilIdle();

        self::assertSame([], self::sender()->sent);
        self::assertSame('cancelled', self::scalar('SELECT status FROM scheduled_notifications'));
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

    private function members(): Audience
    {
        return Audience::membersWithPermission($this->organisation->getId(), Permission::BillingManage);
    }

    private function dueAt(string $key): DateTimeImmutable
    {
        return new DateTimeImmutable(
            Type\string()->coerce(self::scalar("SELECT due_at FROM scheduled_notifications WHERE cancellation_key = :key AND status = 'pending'", ['key' => $key])),
            new DateTimeZone('UTC'),
        );
    }
}
