<?php

declare(strict_types=1);

namespace App\Domain\Event;

use DateTimeImmutable;
use DateTimeZone;
use Psl\Vec;

/** A wall-clock time in a zone, as the instant RFC 5545 §3.3.5 makes it: a skipped time moves later by the gap, a repeated one takes the earlier offset. */
final class LocalTimeResolver
{
    private const int DAY = 86_400;

    public static function resolve(DateTimeImmutable $wallClock, DateTimeZone $zone): DateTimeImmutable
    {
        $local = new DateTimeImmutable($wallClock->format('Y-m-d H:i:s'), new DateTimeZone('UTC'));
        $before = $zone->getOffset($local->setTimestamp($local->getTimestamp() - self::DAY));
        $after = $zone->getOffset($local->setTimestamp($local->getTimestamp() + self::DAY));

        $valid = Vec\filter(
            [$before, $after],
            static fn (int $offset): bool => $zone->getOffset($local->setTimestamp($local->getTimestamp() - $offset)) === $offset,
        );

        $offset = $valid[0] ?? $before;

        return $local->setTimestamp($local->getTimestamp() - $offset)->setTimezone($zone);
    }
}
