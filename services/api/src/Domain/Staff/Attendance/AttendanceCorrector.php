<?php

declare(strict_types=1);

namespace App\Domain\Staff\Attendance;

use App\Audit\Auditor;
use App\Domain\Staff\ShiftClock;
use App\Entity\ShiftAttendance;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\ShiftAttendanceRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psr\Clock\ClockInterface;

/**
 * Correcting a person's times on a shift (sc-234), as sc-63's form checks have them, by a member who manages staff and never on their own shift.
 *
 * What was recorded is kept; a time that matches it again withdraws its correction, and a save that changes nothing writes nothing.
 */
final readonly class AttendanceCorrector
{
    public const string CORRECTED = 'staff.hours_corrected';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private ShiftAttendanceRepository $shiftAttendanceRepository,
        private Auditor $auditor,
        private ClockInterface $clock,
    ) {
    }

    /** Both times as typed on the event's clock, `YYYY-MM-DDTHH:MM`; the clock-out blank only while the person is still clocked in. */
    public function correct(StaffShift $shift, StaffMember $person, string $typedIn, ?string $typedOut, User $by): void
    {
        if (true === $person->getAccount()?->getId()->equals($by->getId())) {
            throw new ApiException(ErrorCode::Forbidden, 'staff.hours_own');
        }

        $event = $shift->getJob()->getEvent();
        $attendance = $this->shiftAttendanceRepository->findOneOn($shift, $person);
        $now = $this->clock->now();
        $inWall = ShiftClock::wall($typedIn) ?? throw self::refused('clockedInAt', 'staff.hours_in_blank');
        $in = ShiftClock::instant($inWall, $event);
        $out = null;

        if (null === $typedOut || '' === Str\trim($typedOut)) {
            if (!ClockWindow::stillOn($shift, $attendance, $now)) {
                throw self::refused('clockedOutAt', 'staff.hours_out_blank');
            }
        } else {
            $outWall = ShiftClock::wall($typedOut) ?? throw self::refused('clockedOutAt', 'staff.hours_out_blank');
            $out = ShiftClock::instant($outWall, $event);

            if ($out <= $in) {
                throw self::refused('clockedOutAt', 'staff.hours_order');
            }

            if ($out->getTimestamp() - $in->getTimestamp() > ClockWindow::LONGEST_SECONDS) {
                throw self::refused('clockedOutAt', 'staff.hours_long');
            }
        }

        if (self::same($attendance?->countedIn(), $in) && self::same($attendance?->countedOut(), $out)) {
            return;
        }

        $this->entityManager->wrapInTransaction(function () use ($shift, $person, $attendance, $in, $out, $by, $now): void {
            if (null === $attendance) {
                $attendance = new ShiftAttendance($shift, $person);
                $this->entityManager->persist($attendance);
            }

            $was = ['in' => self::written($attendance->countedIn()), 'out' => self::written($attendance->countedOut())];
            $attendance->correctIn(self::same($attendance->getClockedInAt(), $in) ? null : $in, $by->getName(), $now);
            $attendance->correctOut(self::same($attendance->getClockedOutAt(), $out) ? null : $out, $by->getName(), $now);
            $this->auditor->record(self::CORRECTED, 'StaffMember', $person->getId(), Actor::User, $by->getId(), $by->getName(), [
                'shift' => [$shift->getId()->toRfc4122(), $shift->getId()->toRfc4122()],
                'clockedInAt' => [$was['in'], self::written($in)],
                'clockedOutAt' => [$was['out'], self::written($out)],
            ]);
            $this->entityManager->flush();
        });
    }

    private static function same(?DateTimeImmutable $one, ?DateTimeImmutable $other): bool
    {
        return $one?->getTimestamp() === $other?->getTimestamp();
    }

    private static function written(?DateTimeImmutable $at): ?string
    {
        return $at?->format(\DATE_ATOM);
    }

    private static function refused(string $field, string $key): ApiException
    {
        return ApiException::validation([[
            'propertyPath' => $field,
            'message' => $key,
            'code' => ErrorCode::ValidationFailed->value,
            'parameters' => [],
        ]]);
    }
}
