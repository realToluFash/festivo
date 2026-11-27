<?php

declare(strict_types=1);

namespace App\Domain\Staff\Http;

use App\Domain\Staff\Attendance\ClockWindow;
use App\Entity\ShiftAttendance;
use App\Entity\StaffShift;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Math;

/**
 * A person's clock card on one shift (sc-234), every time in the event's offset; null once it is gone.
 *
 * @phpstan-type Card array{phase: string, opensAt: string, closesAt: string, clockedInAt: ?string, clockedOutAt: ?string, outUntil: ?string, workedMinutes: ?int}
 */
final readonly class ClockCardSerialiser
{
    /** @return Card|null */
    public static function card(StaffShift $shift, ?ShiftAttendance $attendance, DateTimeImmutable $now): ?array
    {
        $phase = ClockWindow::phase($shift, $attendance, $now);

        if (null === $phase) {
            return null;
        }

        $zone = new DateTimeZone($shift->getJob()->getEvent()->getTimeZone());
        $at = static fn (?DateTimeImmutable $instant): ?string => $instant?->setTimezone($zone)->format(\DATE_ATOM);
        $in = $attendance?->countedIn();
        $out = $attendance?->countedOut();

        return [
            'phase' => $phase->value,
            'opensAt' => $at(ClockWindow::opensAt($shift)) ?? '',
            'closesAt' => $at(ClockWindow::endOf($shift)) ?? '',
            'clockedInAt' => $at($in),
            'clockedOutAt' => $at($out),
            'outUntil' => null === $in ? null : $at(ClockWindow::outUntil($shift, $in)),
            'workedMinutes' => null === $in || null === $out ? null : Math\div(Math\maxva(0, $out->getTimestamp() - $in->getTimestamp()), 60),
        ];
    }
}
