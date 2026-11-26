<?php

declare(strict_types=1);

namespace App\Domain\Staff\Attendance;

use App\Domain\Staff\ShiftClock;
use App\Entity\ShiftAttendance;
use App\Entity\StaffShift;
use App\Enum\ClockPhase;
use DateTimeImmutable;

/**
 * When a shift takes a clock-in and a clock-out (sc-234), as instants.
 *
 * Clock in from an hour before the scheduled start until the scheduled end; clock out from the clock-in until 6 hours after the scheduled end, and never more than 24 hours after the clock-in.
 */
final readonly class ClockWindow
{
    private const string OPENS_BEFORE = '-60 minutes';

    private const string OUT_AFTER_END = '+6 hours';

    private const string LONGEST = '+24 hours';

    public const int LONGEST_SECONDS = 86_400;

    public static function opensAt(StaffShift $shift): DateTimeImmutable
    {
        return self::startOf($shift)->modify(self::OPENS_BEFORE);
    }

    public static function startOf(StaffShift $shift): DateTimeImmutable
    {
        return ShiftClock::instant($shift->getStartsAt(), $shift->getJob()->getEvent());
    }

    /** The scheduled end, when Clock in closes. */
    public static function endOf(StaffShift $shift): DateTimeImmutable
    {
        return ShiftClock::instant($shift->getEndsAt(), $shift->getJob()->getEvent());
    }

    public static function outUntil(StaffShift $shift, DateTimeImmutable $clockedIn): DateTimeImmutable
    {
        $afterEnd = self::endOf($shift)->modify(self::OUT_AFTER_END);
        $longest = $clockedIn->modify(self::LONGEST);

        return $afterEnd < $longest ? $afterEnd : $longest;
    }

    /** Null once the card is gone: clocked in, never out, and past the limit. */
    public static function phase(StaffShift $shift, ?ShiftAttendance $attendance, DateTimeImmutable $now): ?ClockPhase
    {
        $in = $attendance?->countedIn();

        if (null === $in) {
            return match (true) {
                $now < self::opensAt($shift) => ClockPhase::Before,
                $now < self::endOf($shift) => ClockPhase::Ready,
                default => ClockPhase::Closed,
            };
        }

        if (null !== $attendance?->countedOut()) {
            return ClockPhase::Off;
        }

        return $now < self::outUntil($shift, $in) ? ClockPhase::On : null;
    }

    /** Clocked in, not out, and still able to clock out: a correction may leave the clock-out empty. */
    public static function stillOn(StaffShift $shift, ?ShiftAttendance $attendance, DateTimeImmutable $now): bool
    {
        return ClockPhase::On === self::phase($shift, $attendance, $now);
    }
}
