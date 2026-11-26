<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Messaging\PushTargets;
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
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** Null before the person's briefing went, and whenever push has not reached them, so the row stays sc-3917's (sc-4333); a date line's values are days, not instants. */
final readonly class ShiftNoticeStates
{
    public function __construct(
        private Connection $connection,
        private ToldShifts $toldShifts,
        private PushTargets $pushTargets,
    ) {
    }

    /** @return array{waiting: array<string, string>, sent: array<string, string>, inApp: array<string, true>} waiting and sent by the person's id, inApp by their account's */
    public function ofEvent(Event $event): array
    {
        $eventId = $event->getId()->toRfc4122();
        $waiting = $this->connection->fetchAllKeyValue(
            'SELECT source_id, due_at FROM scheduled_notifications WHERE type = :type AND event_id = :event AND status = :pending',
            ['type' => ShiftChangeNotice::NAME, 'event' => $eventId, 'pending' => ScheduledNotificationStatus::Pending->value],
        );
        $sent = $this->connection->fetchAllKeyValue(
            'SELECT source_id, MAX(finished_at) FROM notification_deliveries WHERE type = :type AND event_id = :event AND status = :sent GROUP BY source_id',
            ['type' => ShiftChangeNotice::NAME, 'event' => $eventId, 'sent' => NotificationDeliveryStatus::Sent->value],
        );
        $accounts = $this->connection->fetchFirstColumn('SELECT account_id FROM staff_members WHERE event_id = :event AND account_id IS NOT NULL', ['event' => $eventId]);

        return [
            'waiting' => Type\dict(Type\string(), Type\string())->coerce($waiting),
            'sent' => Type\dict(Type\string(), Type\string())->coerce($sent),
            'inApp' => $this->pushTargets->inApp(...Vec\map($accounts, static fn (mixed $id): Uuid => Uuid::fromString(Type\string()->coerce($id)))),
        ];
    }

    /**
     * @param list<StaffShift>                                                                      $shifts the person's shifts
     * @param ?array{waiting: array<string, string>, sent: array<string, string>, inApp: array<string, true>} $known the event's, read when null
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

        if (null !== $goesAt && $this->inApp($entry, $known)) {
            return [
                'state' => 'waiting',
                'goesAt' => self::instant($goesAt)->setTimezone($zone)->format(\DATE_ATOM),
                'changes' => Vec\map($this->toldShifts->changesOf($entry, $shifts), static fn (ShiftChange $change): array => self::change($change, $event)),
            ];
        }

        $sentAt = $known['sent'][$id] ?? null;

        if (null === $sentAt || [] !== $this->toldShifts->changesOf($entry, $shifts)) {
            return null;
        }

        return ['state' => 'told', 'at' => self::instant($sentAt)->setTimezone($zone)->format(\DATE_ATOM), 'channel' => 'push'];
    }

    /**
     * Signed in to the app with notifications allowed, so a change notice can reach them; the removal question says so only then.
     *
     * @param ?array{waiting: array<string, string>, sent: array<string, string>, inApp: array<string, true>} $known the event's, read when null
     */
    public function inApp(StaffMember $entry, ?array $known = null): bool
    {
        $account = $entry->getAccount();

        if (null === $account) {
            return false;
        }

        $known ??= $this->ofEvent($entry->getEvent());

        return isset($known['inApp'][$account->getId()->toRfc4122()]);
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

    private static function instant(string $stored): DateTimeImmutable
    {
        return new DateTimeImmutable($stored, new DateTimeZone('UTC'));
    }
}
