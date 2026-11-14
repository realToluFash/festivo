<?php

declare(strict_types=1);

namespace App\Enum;

use DateTimeImmutable;

/** What a subscribed calendar is told about an event (sc-3626): there, or called off or deleted and kept as CANCELLED while the restore window is open so the calendar removes it, then left out. */
enum FeedEntryStatus: string
{
    case Confirmed = 'CONFIRMED';
    case Cancelled = 'CANCELLED';

    /** Null once a cancellation is at or before $keptAfter: the event drops out of the feed. */
    public static function of(?DateTimeImmutable $deletedAt, ?DateTimeImmutable $endedAt, DateTimeImmutable $startsAt, DateTimeImmutable $keptAfter): ?self
    {
        $cancelledAt = $deletedAt ?? (EventPhase::calledOff($endedAt, $startsAt) ? $endedAt : null);

        if (null === $cancelledAt) {
            return self::Confirmed;
        }

        return $cancelledAt > $keptAfter ? self::Cancelled : null;
    }
}
