<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Trigger;
use App\Entity\Event;
use App\Enum\NotificationChannel;
use App\Enum\NotificationDeliveryStatus;
use App\Enum\NotificationPriority;
use App\Enum\ScheduledNotificationStatus;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use InvalidArgumentException;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use stdClass;
use Symfony\Component\Uid\Uuid;

/** Writes through the caller's open transaction, so a change and the notification it causes commit together. */
final readonly class NotificationScheduler
{
    public function __construct(
        private Connection $connection,
        private NotificationRegistry $notificationRegistry,
        private ClockInterface $clock,
    ) {
    }

    /** @param array<string, mixed> $payload what the type renders from, and checks at send time */
    public function schedule(string $type, string $cancellationKey, string $sourceId, Trigger $trigger, Audience $audience, array $payload = [], ?Event $event = null): Uuid
    {
        $definition = $this->notificationRegistry->type($type);

        if ($definition->audienceKind() !== $audience->kind) {
            throw new InvalidArgumentException(Str\format('"%s" is for a %s audience.', $type, $definition->audienceKind()->value));
        }

        $times = null === $event ? null : EventTimes::of($event);
        $dueAt = $trigger->dueAt($times);
        $urgent = NotificationPriority::Urgent === $definition->priority() || Iter\contains($definition->channels(), NotificationChannel::InApp);
        $id = Uuid::v7();

        $this->connection->transactional(function () use ($id, $type, $cancellationKey, $sourceId, $trigger, $audience, $payload, $event, $dueAt, $definition, $times, $urgent): void {
            $this->remove($cancellationKey);
            $this->connection->insert('scheduled_notifications', [
                'id' => $id->toRfc4122(),
                'type' => $type,
                'cancellation_key' => $cancellationKey,
                'source_id' => $sourceId,
                'event_id' => $event?->getId()->toRfc4122(),
                'trigger' => Json\encode($trigger->toArray()),
                'due_at' => $dueAt,
                'send_by' => $definition->tooLateAt($dueAt, $times),
                'audience' => Json\encode($audience->toArray()),
                'payload' => Json\encode([] === $payload ? new stdClass() : $payload),
                'priority' => ($urgent ? NotificationPriority::Urgent : $definition->priority())->value,
                'status' => ScheduledNotificationStatus::Pending->value,
                'created_at' => $this->clock->now(),
            ], [
                'due_at' => Types::DATETIME_IMMUTABLE,
                'send_by' => Types::DATETIME_IMMUTABLE,
                'created_at' => Types::DATETIME_IMMUTABLE,
            ]);
        });

        return $id;
    }

    /** @return int how many pending rows the key had, scheduled and fanned out */
    public function cancel(string $cancellationKey): int
    {
        return $this->connection->transactional(fn (): int => $this->remove($cancellationKey));
    }

    /** After an event's date, time or zone changes: each pending row counted from the event is written again at its new due time. */
    public function rescheduleForEvent(Event $event): int
    {
        $rows = $this->connection->fetchAllAssociative(
            <<<'SQL'
                SELECT type, cancellation_key, source_id, trigger, audience, payload
                FROM scheduled_notifications
                WHERE event_id = :event
                  AND status = :pending
                  AND trigger->>'anchor' <> 'date'
                ORDER BY id
                SQL,
            ['event' => $event->getId()->toRfc4122(), 'pending' => ScheduledNotificationStatus::Pending->value],
        );

        foreach ($rows as $row) {
            $this->schedule(
                Type\string()->coerce($row['type']),
                Type\string()->coerce($row['cancellation_key']),
                Type\string()->coerce($row['source_id']),
                Trigger::fromArray(Json\typed(Type\string()->coerce($row['trigger']), Type\dict(Type\string(), Type\mixed()))),
                Audience::fromArray(Json\typed(Type\string()->coerce($row['audience']), Type\dict(Type\string(), Type\mixed()))),
                Json\typed(Type\string()->coerce($row['payload']), Type\dict(Type\string(), Type\mixed())),
                $event,
            );
        }

        return Iter\count($rows);
    }

    /** The scheduled row is updated first: its lock makes a fan-out in progress finish its chunk before these deliveries are deleted. */
    private function remove(string $cancellationKey): int
    {
        $scheduled = (int) $this->connection->executeStatement(
            <<<'SQL'
                UPDATE scheduled_notifications
                SET status = :cancelled, outcome = 'cancelled by key', finished_at = :now, claimed_until = NULL
                WHERE cancellation_key = :key AND status = :pending
                SQL,
            [
                'key' => $cancellationKey,
                'pending' => ScheduledNotificationStatus::Pending->value,
                'cancelled' => ScheduledNotificationStatus::Cancelled->value,
                'now' => $this->clock->now(),
            ],
            ['now' => Types::DATETIME_IMMUTABLE],
        );

        $deliveries = (int) $this->connection->executeStatement(
            <<<'SQL'
                DELETE FROM notification_deliveries
                WHERE status = :pending
                  AND scheduled_notification_id IN (
                      SELECT id FROM scheduled_notifications WHERE cancellation_key = :key
                  )
                SQL,
            ['key' => $cancellationKey, 'pending' => NotificationDeliveryStatus::Pending->value],
        );

        return $scheduled + $deliveries;
    }
}
