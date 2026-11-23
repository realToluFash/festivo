<?php

declare(strict_types=1);

namespace App\Domain\Budget\Reminder;

use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\EventAnchor;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Trigger;
use App\Domain\Messaging\NotificationScheduler;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Entity\ScheduledPayment;
use App\Enum\NotificationDeliveryStatus;
use App\Enum\Permission;
use App\Enum\ScheduledNotificationStatus;
use App\Repository\ScheduledPaymentRepository;
use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Json;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** Each owed payment has two reminders, the days before it falls due and the day after (sc-95), keyed by payment so that paying or cancelling it removes both, and one already sent is never written again. */
final readonly class PaymentReminders
{
    public const string COMING_DUE = 'coming_due';

    public const string OVERDUE = 'overdue';

    public const string TIME_OF_DAY = '09:00';

    /** How long a late reminder waits for the rest added with it (sc-83852). */
    public const string HOLD = 'PT15M';

    public function __construct(
        private NotificationScheduler $notificationScheduler,
        private ScheduledPaymentRepository $scheduledPaymentRepository,
        private Connection $connection,
        private ClockInterface $clock,
    ) {
    }

    public static function key(Uuid $paymentId, string $kind): string
    {
        return 'payment-reminder:' . $paymentId->toRfc4122() . ':' . $kind;
    }

    /** The day it is now on the event's clock, as Y-m-d. */
    public static function today(Event $event, DateTimeImmutable $now): string
    {
        return $now->setTimezone(new DateTimeZone($event->getTimeZone()))->format('Y-m-d');
    }

    /** After any change to a payment, in the transaction that made it. A payment already past due when it becomes owed has only the overdue one, and a reminder whose day has passed is held (sc-83852). */
    public function follow(ScheduledPayment $payment): void
    {
        if ($payment->isPaid() || $payment->isCancelled()) {
            $this->forget($payment->getId());

            return;
        }

        $event = $payment->getEngagement()->getEvent();
        $organisation = $event->getOrganisation();
        $dueOn = $payment->getDueOn()->format('Y-m-d');
        $pastDue = self::today($event, $this->clock->now()) > $dueOn;
        $offsets = [
            self::COMING_DUE => '-P' . $organisation->getPaymentReminderDays() . 'D',
            self::OVERDUE => 'P1D',
        ];

        foreach ($offsets as $kind => $offset) {
            $key = self::key($payment->getId(), $kind);

            if ($this->sent($key)) {
                continue;
            }

            if (self::COMING_DUE === $kind && $pastDue) {
                $this->notificationScheduler->cancel($key);

                continue;
            }

            $this->notificationScheduler->schedule(
                PaymentReminder::NAME,
                $key,
                $key,
                $this->trigger($key, Trigger::relativeTo($dueOn, $offset, self::TIME_OF_DAY), $event),
                Audience::membersOfEvent($organisation->getId(), $event->getId(), Permission::BudgetManage),
                ['paymentId' => $payment->getId()->toRfc4122(), 'kind' => $kind],
                $event,
            );
        }
    }

    public function forget(Uuid $paymentId): void
    {
        $this->notificationScheduler->cancel(self::key($paymentId, self::COMING_DUE));
        $this->notificationScheduler->cancel(self::key($paymentId, self::OVERDUE));
    }

    /** After the organisation's days change: every reminder not sent yet is written again at its new day. */
    public function followAll(Organisation $organisation): void
    {
        foreach ($this->scheduledPaymentRepository->findOwedInOrganisation($organisation) as $payment) {
            $this->follow($payment);
        }
    }

    /** A late one goes when the organisation's open hold ends, else after HOLD; one already held, or unchanged, keeps its time. */
    private function trigger(string $key, Trigger $onTheDay, Event $event): Trigger
    {
        $now = $this->clock->now();

        if ($onTheDay->dueAt(EventTimes::of($event)) > $now) {
            return $onTheDay;
        }

        $organisationId = $event->getOrganisation()->getId()->toRfc4122();
        $this->connection->executeStatement('SELECT pg_advisory_xact_lock(hashtext(:hold))', ['hold' => self::HOLD . ':' . $organisationId]);

        $pending = $this->connection->fetchOne(
            'SELECT trigger FROM scheduled_notifications WHERE cancellation_key = :key AND status = :pending',
            ['key' => $key, 'pending' => ScheduledNotificationStatus::Pending->value],
        );

        if (false !== $pending) {
            $kept = Trigger::fromArray(Json\typed(Type\string()->coerce($pending), Type\dict(Type\string(), Type\mixed())));

            if (EventAnchor::Moment === $kept->anchor || $kept->toArray() === $onTheDay->toArray()) {
                return $kept;
            }
        }

        $open = $this->connection->fetchOne(
            <<<'SQL'
                SELECT MIN(due_at)
                FROM scheduled_notifications
                WHERE type = :type
                  AND organisation_id = :organisation
                  AND status = :pending
                  AND trigger->>'anchor' = :moment
                  AND due_at > :now
                SQL,
            [
                'type' => PaymentReminder::NAME,
                'organisation' => $organisationId,
                'pending' => ScheduledNotificationStatus::Pending->value,
                'moment' => EventAnchor::Moment->value,
                'now' => $now,
            ],
            ['now' => Types::DATETIME_IMMUTABLE],
        );

        return Trigger::at(null === $open || false === $open ? $now->add(new DateInterval(self::HOLD)) : new DateTimeImmutable(Type\string()->coerce($open), new DateTimeZone('UTC')));
    }

    private function sent(string $key): bool
    {
        return false !== $this->connection->fetchOne(
            <<<'SQL'
                SELECT 1
                FROM scheduled_notifications s
                JOIN notification_deliveries d ON d.scheduled_notification_id = s.id
                WHERE s.cancellation_key = :key
                  AND d.status = :sent
                LIMIT 1
                SQL,
            ['key' => $key, 'sent' => NotificationDeliveryStatus::Sent->value],
        );
    }
}
