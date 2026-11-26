<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Staff\ShiftClock;
use App\Domain\Staff\ShiftNotice\Model\ShiftChange;
use App\Entity\Event;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Enum\NotificationDeliveryStatus;
use App\Enum\ScheduledNotificationStatus;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** Null before the person's briefing went (sc-4333); a date line's values are days, not instants. */
final readonly class ShiftNoticeStates
{
    public function __construct(
        private Connection $connection,
        private ToldShifts $toldShifts,
    ) {
    }

    /** @return array{waiting: array<string, string>, finished: array<string, array<string, mixed>>} each by the person's id */
    public function ofEvent(Event $event): array
    {
        $eventId = $event->getId()->toRfc4122();
        $waiting = $this->connection->fetchAllKeyValue(
            'SELECT source_id, due_at FROM scheduled_notifications WHERE type = :type AND event_id = :event AND status = :pending',
            ['type' => ShiftChangeNotice::NAME, 'event' => $eventId, 'pending' => ScheduledNotificationStatus::Pending->value],
        );
        $finished = $this->connection->fetchAllAssociativeIndexed(
            <<<'SQL'
                SELECT DISTINCT ON (source_id) source_id, status, channel, finished_at, last_error
                FROM notification_deliveries
                WHERE type = :type AND event_id = :event AND status IN (:sent, :failed)
                ORDER BY source_id, finished_at DESC
                SQL,
            ['type' => ShiftChangeNotice::NAME, 'event' => $eventId, 'sent' => NotificationDeliveryStatus::Sent->value, 'failed' => NotificationDeliveryStatus::Failed->value],
        );

        return [
            'waiting' => Type\dict(Type\string(), Type\string())->coerce($waiting),
            'finished' => Type\dict(Type\string(), Type\dict(Type\string(), Type\mixed()))->coerce($finished),
        ];
    }

    /**
     * @param list<StaffShift>                                                                      $shifts the person's shifts
     * @param ?array{waiting: array<string, string>, finished: array<string, array<string, mixed>>} $known  the event's, read when null
     *
     * @return ?array<string, mixed>
     */
    public function of(StaffMember $entry, array $shifts, ?array $known = null): ?array
    {
        if (null === $entry->getTold()) {
            return null;
        }

        $event = $entry->getEvent();
        $id = $entry->getId()->toRfc4122();
        $known ??= $this->ofEvent($event);
        $goesAt = $known['waiting'][$id] ?? null;
        $zone = new DateTimeZone($event->getTimeZone());

        if (null !== $goesAt) {
            return [
                'state' => 'waiting',
                'goesAt' => self::instant($goesAt)->setTimezone($zone)->format(\DATE_ATOM),
                'changes' => Vec\map($this->toldShifts->changesOf($entry, $shifts), static fn (ShiftChange $change): array => self::change($change, $event)),
            ];
        }

        $last = $known['finished'][$id] ?? null;

        if (null !== $last) {
            $sent = NotificationDeliveryStatus::Sent->value === $last['status'];

            return $sent
                ? ['state' => 'told', 'at' => self::instant(Type\string()->coerce($last['finished_at']))->setTimezone($zone)->format(\DATE_ATOM), 'channel' => $last['channel']]
                : ['state' => 'not_delivered', 'reason' => self::reason(Type\nullable(Type\string())->coerce($last['last_error']))];
        }

        return null === $entry->getAccount() ? ['state' => 'unreachable'] : null;
    }

    /** @return array<string, mixed> */
    private static function change(ShiftChange $change, Event $event): array
    {
        $at = static fn (?DateTimeImmutable $wall): ?string => null === $wall ? null : ShiftClock::instant($wall, $event)->format(\DATE_ATOM);

        return [
            'kind' => $change->kind->value,
            'start' => $at($change->start),
            'end' => $at($change->end),
            'oldStart' => $at($change->oldStart),
            'oldEnd' => $at($change->oldEnd),
            'new' => $change->new,
            'old' => $change->old,
            'count' => $change->count,
        ];
    }

    /** `no_device` when push found no device of theirs (the worker records an Unreachable by its message alone), `provider` when the provider refused it (recorded with the failure's class). */
    private static function reason(?string $error): string
    {
        return null === $error || !Str\contains($error, '\\') ? 'no_device' : 'provider';
    }

    private static function instant(string $stored): DateTimeImmutable
    {
        return new DateTimeImmutable($stored, new DateTimeZone('UTC'));
    }
}
