<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\EventAnchor;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Trigger;
use App\Entity\Event;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationChannel;
use App\Enum\NotificationDeliveryStatus;
use App\Enum\NotificationPriority;
use App\Enum\ScheduledNotificationStatus;
use DateTimeImmutable;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use InvalidArgumentException;
use LogicException;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use stdClass;
use Symfony\Component\Uid\Uuid;

/** Writes through the caller's open transaction, so a change and the notification it causes commit together. */
final readonly class NotificationScheduler
{
    public const string CANCELLED_BY_KEY = 'cancelled by key';

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
                'organisation_id' => $audience->organisationId?->toRfc4122(),
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

    /**
     * To one person, fixed now (sc-4332): the delivery is written with the row, so nothing resolves the audience later. A type that supersedes replaces the person's earlier one that has not gone.
     *
     * @param array<string, mixed> $payload
     * @param ?DateTimeImmutable   $sendBy  a code's expiry, after which it is never sent
     *
     * @return bool false when the same send was already queued
     */
    public function scheduleForPerson(string $type, string $sourceId, Audience $audience, array $payload, ?DateTimeImmutable $sendBy = null): bool
    {
        $definition = $this->notificationRegistry->type($type);
        $recipient = $audience->only[0] ?? null;

        if (NotificationAudienceKind::Person !== $definition->audienceKind() || NotificationAudienceKind::Person !== $audience->kind || null === $recipient) {
            throw new InvalidArgumentException(Str\format('"%s" is not sent to one person.', $type));
        }

        if (!$this->connection->isTransactionActive()) {
            throw new LogicException(Str\format('"%s" is written in the transaction of the change it tells of, so the two commit together.', $type));
        }

        $now = $this->clock->now();
        $id = Uuid::v7();
        $types = ['due' => Types::DATETIME_IMMUTABLE, 'sendBy' => Types::DATETIME_IMMUTABLE, 'now' => Types::DATETIME_IMMUTABLE];

        return $this->connection->transactional(function () use ($id, $type, $sourceId, $audience, $payload, $sendBy, $definition, $recipient, $now, $types): bool {
            if ($definition->supersedesEarlier()) {
                $this->connection->executeStatement(
                    <<<'SQL'
                        WITH superseded AS (
                            UPDATE notification_deliveries
                            SET status = :superseded, finished_at = :now, claimed_until = NULL
                            WHERE type = :type AND recipient_kind = :kind AND recipient_id = :recipient
                              AND source_id <> :source
                              AND status = :pending
                              AND (claimed_until IS NULL OR claimed_until < :now)
                            RETURNING scheduled_notification_id
                        )
                        UPDATE scheduled_notifications SET payload = '{}'
                        WHERE :forget AND id IN (SELECT scheduled_notification_id FROM superseded)
                        SQL,
                    [
                        'forget' => $definition->carriesCode(),
                        'superseded' => NotificationDeliveryStatus::Superseded->value,
                        'now' => $now,
                        'type' => $type,
                        'kind' => NotificationAudienceKind::Person->value,
                        'recipient' => $recipient->toRfc4122(),
                        'source' => $sourceId,
                        'pending' => NotificationDeliveryStatus::Pending->value,
                    ],
                    ['now' => Types::DATETIME_IMMUTABLE, 'forget' => Types::BOOLEAN],
                );
            }

            $this->connection->executeStatement(
                <<<'SQL'
                    INSERT INTO scheduled_notifications (
                        id, type, cancellation_key, source_id, trigger, due_at, send_by, audience, payload, priority, status, created_at, finished_at
                    ) VALUES (
                        :id, :type, :key, :source, :trigger, :due, :sendBy, :audience, :payload, :priority, :fannedOut, :now, :now
                    )
                    SQL,
                [
                    'id' => $id->toRfc4122(),
                    'type' => $type,
                    'key' => 'person:' . $id->toRfc4122(),
                    'source' => $sourceId,
                    'trigger' => Json\encode(Trigger::at($now)->toArray()),
                    'due' => $now,
                    'sendBy' => $sendBy,
                    'audience' => Json\encode($audience->toArray()),
                    'payload' => Json\encode([] === $payload ? new stdClass() : $payload),
                    'priority' => $definition->priority()->value,
                    'fannedOut' => ScheduledNotificationStatus::FannedOut->value,
                    'now' => $now,
                ],
                $types,
            );

            $written = 0 < $this->connection->executeStatement(
                <<<'SQL'
                    INSERT INTO notification_deliveries (
                        id, scheduled_notification_id, type, source_id, recipient_kind, recipient_id, channel,
                        priority, status, due_at, next_attempt_at, send_by, attempts, created_at
                    ) VALUES (
                        :id, :scheduled, :type, :source, :kind, :recipient, :channel,
                        :priority, :pending, :due, :due, :sendBy, 0, :now
                    )
                    ON CONFLICT (type, source_id, recipient_kind, recipient_id, channel) DO NOTHING
                    SQL,
                [
                    'id' => Uuid::v7()->toRfc4122(),
                    'scheduled' => $id->toRfc4122(),
                    'type' => $type,
                    'source' => $sourceId,
                    'kind' => NotificationAudienceKind::Person->value,
                    'recipient' => $recipient->toRfc4122(),
                    'channel' => NotificationChannel::Email->value,
                    'priority' => $definition->priority()->value,
                    'pending' => NotificationDeliveryStatus::Pending->value,
                    'due' => $now,
                    'sendBy' => $sendBy,
                    'now' => $now,
                ],
                $types,
            );

            if (!$written) {
                $this->connection->executeStatement('DELETE FROM scheduled_notifications WHERE id = :id', ['id' => $id->toRfc4122()]);
            }

            return $written;
        });
    }

    /** @return int how many pending rows the key had, scheduled and fanned out */
    public function cancel(string $cancellationKey): int
    {
        return $this->connection->transactional(fn (): int => $this->remove($cancellationKey));
    }

    /** After an event's date or time changes: each pending row counted from the event is written again at its new due time. */
    public function rescheduleForEvent(Event $event): int
    {
        return $this->reschedule($event, [EventAnchor::EventStart, EventAnchor::EventEnd]);
    }

    /** After an event's clock changes, to a new zone or to new rules for its zone: a caller's day is read again on the new clock too, with its same date, offset and time of day. */
    public function rescheduleForNewZone(Event $event): int
    {
        return $this->reschedule($event, [EventAnchor::EventStart, EventAnchor::EventEnd, EventAnchor::Date]);
    }

    /** @param list<EventAnchor> $anchors */
    private function reschedule(Event $event, array $anchors): int
    {
        $rows = $this->connection->fetchAllAssociative(
            <<<'SQL'
                SELECT type, cancellation_key, source_id, trigger, audience, payload
                FROM scheduled_notifications
                WHERE event_id = :event
                  AND status = :pending
                  AND trigger->>'anchor' IN (:anchors)
                ORDER BY id
                SQL,
            [
                'event' => $event->getId()->toRfc4122(),
                'pending' => ScheduledNotificationStatus::Pending->value,
                'anchors' => Vec\map($anchors, static fn (EventAnchor $anchor): string => $anchor->value),
            ],
            ['anchors' => ArrayParameterType::STRING],
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

    /** The scheduled row is updated first: its lock makes a fan-out in progress finish its chunk before these deliveries are deleted. A delivery a worker holds is left to it: recorded Sent if its call goes, deleted if not. */
    private function remove(string $cancellationKey): int
    {
        $scheduled = (int) $this->connection->executeStatement(
            <<<'SQL'
                UPDATE scheduled_notifications
                SET status = :cancelled, outcome = :outcome, held = NULL, finished_at = :now, claimed_until = NULL
                WHERE cancellation_key = :key AND status = :pending
                SQL,
            [
                'key' => $cancellationKey,
                'pending' => ScheduledNotificationStatus::Pending->value,
                'cancelled' => ScheduledNotificationStatus::Cancelled->value,
                'outcome' => self::CANCELLED_BY_KEY,
                'now' => $this->clock->now(),
            ],
            ['now' => Types::DATETIME_IMMUTABLE],
        );

        $this->connection->executeStatement(
            <<<'SQL'
                UPDATE scheduled_notifications s
                SET status = :cancelled, outcome = :outcome, finished_at = :now
                WHERE s.cancellation_key = :key
                  AND s.status = :fannedOut
                  AND EXISTS (SELECT 1 FROM notification_deliveries d WHERE d.scheduled_notification_id = s.id AND d.status = :deliveryPending)
                SQL,
            [
                'key' => $cancellationKey,
                'fannedOut' => ScheduledNotificationStatus::FannedOut->value,
                'deliveryPending' => NotificationDeliveryStatus::Pending->value,
                'cancelled' => ScheduledNotificationStatus::Cancelled->value,
                'outcome' => self::CANCELLED_BY_KEY,
                'now' => $this->clock->now(),
            ],
            ['now' => Types::DATETIME_IMMUTABLE],
        );

        $deliveries = (int) $this->connection->executeStatement(
            <<<'SQL'
                DELETE FROM notification_deliveries
                WHERE status = :pending
                  AND (claimed_until IS NULL OR claimed_until < :now)
                  AND scheduled_notification_id IN (
                      SELECT id FROM scheduled_notifications WHERE cancellation_key = :key
                  )
                SQL,
            ['key' => $cancellationKey, 'pending' => NotificationDeliveryStatus::Pending->value, 'now' => $this->clock->now()],
            ['now' => Types::DATETIME_IMMUTABLE],
        );

        return $scheduled + $deliveries;
    }
}
