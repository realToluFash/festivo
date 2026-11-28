<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow;

use DateTimeImmutable;

/** An event day runs from 05:00 to 05:00 in the event's zone, so an item at 00:30 on Saturday is on Friday's (sc-3893, sc-3895, Decided 1 Nov). */
final class EventDay
{
    public const int STARTS_AT_HOUR = 5;

    /** @param DateTimeImmutable $wallClock the item's start as the event's clock reads it */
    public static function of(DateTimeImmutable $wallClock): string
    {
        return $wallClock->modify('-' . self::STARTS_AT_HOUR . ' hours')->format('Y-m-d');
    }
}
