<?php

declare(strict_types=1);

namespace App\Domain\Event;

use DateTimeImmutable;
use DateTimeZone;
use Psl\Math;

/** The calendar dates in the event's zone that its span touches, inclusive; an end at the first instant of a date does not touch it. */
final class EventDayCount
{
    public static function of(DateTimeImmutable $startsAt, DateTimeImmutable $endsAt, DateTimeZone $zone): int
    {
        $start = $startsAt->setTimezone($zone);
        $end = $endsAt->setTimezone($zone);
        $utc = new DateTimeZone('UTC');
        $days = (int) new DateTimeImmutable($start->format('Y-m-d'), $utc)->diff(new DateTimeImmutable($end->format('Y-m-d'), $utc))->format('%r%a');

        if ($end > $start && $end->getTimestamp() === $end->setTime(0, 0)->getTimestamp()) {
            --$days;
        }

        return Math\maxva(1, $days + 1);
    }
}
