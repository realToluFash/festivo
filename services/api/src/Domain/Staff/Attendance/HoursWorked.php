<?php

declare(strict_types=1);

namespace App\Domain\Staff\Attendance;

use App\Domain\Staff\Model\WorkedShift;
use App\Entity\StaffShift;
use App\Enum\HoursMark;
use DateTimeImmutable;
use Psl\Math;

/** Hours actually worked (sc-234), the one place they are worked out: a missing clock-out counts to the scheduled end, a missing clock-in counts nothing. */
final readonly class HoursWorked
{
    public static function of(string $job, string $person, DateTimeImmutable $scheduledEnd, ?DateTimeImmutable $in, ?DateTimeImmutable $out, DateTimeImmutable $now): WorkedShift
    {
        $ended = $now >= $scheduledEnd;

        if (null === $in) {
            return new WorkedShift($job, $person, 0, 0, $ended ? HoursMark::NoAttendance : null);
        }

        if (null !== $out) {
            return new WorkedShift($job, $person, self::minutes($in, $out), 0, null);
        }

        if (!$ended) {
            return new WorkedShift($job, $person, 0, 0, null);
        }

        $assumed = self::minutes($in, $scheduledEnd);

        return new WorkedShift($job, $person, $assumed, $assumed, HoursMark::NotClockedOut);
    }

    /** One person on one shift. */
    public static function placeKey(StaffShift $shift, string $person): string
    {
        return $shift->getId()->toRfc4122() . ':' . $person;
    }

    private static function minutes(DateTimeImmutable $from, DateTimeImmutable $to): int
    {
        return Math\div(Math\maxva(0, $to->getTimestamp() - $from->getTimestamp()), 60);
    }
}
