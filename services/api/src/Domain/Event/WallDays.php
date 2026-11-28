<?php

declare(strict_types=1);

namespace App\Domain\Event;

use DateTimeImmutable;
use DateTimeZone;

/** From the date one wall-clock time reads to the date the other does, whatever their times of day; negative when earlier. */
final class WallDays
{
    public static function between(DateTimeImmutable $from, DateTimeImmutable $to): int
    {
        $utc = new DateTimeZone('UTC');

        return (int) new DateTimeImmutable($from->format('Y-m-d'), $utc)->diff(new DateTimeImmutable($to->format('Y-m-d'), $utc))->format('%r%a');
    }
}
