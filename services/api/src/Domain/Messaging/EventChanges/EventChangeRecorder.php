<?php

declare(strict_types=1);

namespace App\Domain\Messaging\EventChanges;

use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\EventDetails;
use App\Domain\Messaging\Model\Trigger;
use App\Domain\Messaging\NotificationScheduler;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\EventChangeKind;
use App\Enum\EventPhase;
use App\Enum\Permission;
use App\Enum\ScheduledNotificationStatus;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Json;
use Psl\Type;
use Psr\Clock\ClockInterface;
use stdClass;
use Symfony\Component\Uid\Uuid;

/** Tells an event's members when somebody else changes whether, when or where it happens (sc-13214). Call it inside the change's own transaction. */
final readonly class EventChangeRecorder
{
    /** Edits push and email once nothing like them has changed for this long (sc-4333's settle). */
    public const string SETTLE = 'PT15M';

    /** From this long before the start until the end, a change goes as Event day. */
    public const string EVENT_DAY = 'PT24H';

    public function __construct(
        private Connection $connection,
        private NotificationScheduler $notificationScheduler,
        private ClockInterface $clock,
    ) {
    }

    /** A Draft's details are still being planned and a Finished event's can only be corrected, so neither tells (AC 8). */
    public function edited(Event $event, User $by, EventDetails $before, EventDetails $after): void
    {
        $now = $this->clock->now();
        $phase = EventPhase::of($event->getStatus(), $before->startsAt, $before->endsAt, $now);
        $moved = EventDetails::moved($before, $after);

        if (EventPhase::Draft === $phase || EventPhase::Finished === $phase || [] === $moved) {
            return;
        }

        $this->record($event, $by, EventChangeKind::Edited, $moved, self::isEventDay($before, $after, $now), null);
    }

    /** Ending before the start calls the event off (sc-3585). */
    public function ended(Event $event, User $by, EventDetails $before): void
    {
        $kind = $this->clock->now() < $before->startsAt ? EventChangeKind::CalledOff : EventChangeKind::Ended;
        $this->record($event, $by, $kind, [], self::isEventDay($before, $before, $this->clock->now()), null);
    }

    public function acted(Event $event, User $by, EventChangeKind $kind): void
    {
        $details = EventDetails::of($event);
        $this->record($event, $by, $kind, [], self::isEventDay($details, $details, $this->clock->now()), null);
    }

    /** In every state, a Draft's included, and told although the event is gone (AC 11). */
    public function deleted(Event $event, User $by, DateTimeImmutable $restorableUntil): void
    {
        $details = EventDetails::of($event);
        $this->record($event, $by, EventChangeKind::Deleted, [], self::isEventDay($details, $details, $this->clock->now()), $restorableUntil);
    }

    /** By support, whose agent is never named. */
    public function restored(Event $event): void
    {
        $details = EventDetails::of($event);
        $this->record($event, null, EventChangeKind::Restored, [], self::isEventDay($details, $details, $this->clock->now()), null);
    }

    /** The earlier of the two starts counts, so moving tomorrow's event to next week is Event day, and so is moving next week's to tomorrow (AC 10). */
    public static function isEventDay(EventDetails $before, EventDetails $after, DateTimeImmutable $now): bool
    {
        $from = ($before->startsAt < $after->startsAt ? $before->startsAt : $after->startsAt)->sub(new DateInterval(self::EVENT_DAY));
        $until = $before->endsAt > $after->endsAt ? $before->endsAt : $after->endsAt;

        return $now >= $from && $now < $until;
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $fields */
    private function record(Event $event, ?User $by, EventChangeKind $kind, array $fields, bool $eventDay, ?DateTimeImmutable $restorableUntil): void
    {
        $now = $this->clock->now();
        $id = Uuid::v7();
        $this->connection->insert('event_changes', [
            'id' => $id->toRfc4122(),
            'event_id' => $event->getId()->toRfc4122(),
            'actor_id' => $by?->getId()->toRfc4122(),
            'actor_name' => $by?->getName(),
            'kind' => $kind->value,
            'fields' => Json\encode([] === $fields ? new stdClass() : $fields),
            'event_day' => $eventDay,
            'restorable_until' => $restorableUntil,
            'created_at' => $now,
        ], ['event_day' => Types::BOOLEAN, 'restorable_until' => Types::DATETIME_IMMUTABLE, 'created_at' => Types::DATETIME_IMMUTABLE]);

        $audience = Audience::membersWithPermission($event->getOrganisation()->getId(), Permission::EventsRead);
        $source = 'event-change:' . $id->toRfc4122();
        $eventId = $event->getId()->toRfc4122();

        foreach ([EventChangesItem::NAME, EventDayItem::NAME] as $type) {
            $this->notificationScheduler->schedule($type, $type . ':' . $id->toRfc4122(), $source, Trigger::at($now), $audience, ['eventId' => $eventId, 'changeId' => $id->toRfc4122()], $event);
        }

        foreach ([EventChangesNotice::NAME, EventDayNotice::NAME] as $type) {
            $key = $type . ':' . $eventId;
            $pending = $this->pendingPayload($key);
            $since = Type\string()->coerce($pending['since'] ?? $id->toRfc4122());
            $action = $kind->isAction() || true === ($pending['action'] ?? false);
            $dueAt = $action ? $now : $now->add(new DateInterval(self::SETTLE));
            $this->notificationScheduler->schedule($type, $key, $source, Trigger::at($dueAt), $audience, ['eventId' => $eventId, 'since' => $since, 'action' => $action], $event);
        }
    }

    /** @return array<string, mixed> the window's row still waiting under this key, if any */
    private function pendingPayload(string $key): array
    {
        $payload = $this->connection->fetchOne(
            'SELECT payload FROM scheduled_notifications WHERE cancellation_key = :key AND status = :pending',
            ['key' => $key, 'pending' => ScheduledNotificationStatus::Pending->value],
        );

        return false === $payload ? [] : Json\typed(Type\string()->coerce($payload), Type\dict(Type\string(), Type\mixed()));
    }
}
