<?php

declare(strict_types=1);

namespace App\Deletion;

use DateInterval;
use DateTimeImmutable;

/** One instant for everybody (sc-68, sc-868): the deletion plus 30 × 24 hours, never the end of somebody's day. */
final readonly class RestoreWindow
{
    /** Hours, not days: a calendar day across a clock change is 23 or 25 of them. */
    public const string LENGTH = 'PT720H';

    public static function closesAt(DateTimeImmutable $deletedAt): DateTimeImmutable
    {
        return $deletedAt->add(new DateInterval(self::LENGTH));
    }

    /** Closed at the instant itself, not a second after. */
    public static function isOpen(DateTimeImmutable $deletedAt, DateTimeImmutable $now): bool
    {
        return $now < self::closesAt($deletedAt);
    }

    /** As the column stores it, so the deadline shown is the one a restore is checked against. */
    public static function toTheSecond(DateTimeImmutable $at): DateTimeImmutable
    {
        return $at->setTimestamp($at->getTimestamp());
    }
}
