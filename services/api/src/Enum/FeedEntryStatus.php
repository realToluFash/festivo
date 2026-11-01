<?php

declare(strict_types=1);

namespace App\Enum;

use DateInterval;
use DateTimeImmutable;

/** What a subscribed calendar is told about an event (sc-3626): there, or called off or deleted and kept as CANCELLED for 30 days so the calendar removes it, then left out. */
enum FeedEntryStatus: string
{
    case Confirmed = 'CONFIRMED';
    case Cancelled = 'CANCELLED';

    /** Hours, as the restore window counts them. */
    public const string KEPT_CANCELLED = 'PT720H';

    /** Null once a cancellation is older than the 30 days: the event drops out of the feed. */
    public static function of(?DateTimeImmutable $deletedAt, ?DateTimeImmutable $endedAt, DateTimeImmutable $startsAt, DateTimeImmutable $now): ?self
    {
        $cancelledAt = $deletedAt ?? (EventPhase::calledOff($endedAt, $startsAt) ? $endedAt : null);

        if (null === $cancelledAt) {
            return self::Confirmed;
        }

        return $now < $cancelledAt->add(new DateInterval(self::KEPT_CANCELLED)) ? self::Cancelled : null;
    }
}
