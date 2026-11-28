<?php

declare(strict_types=1);

namespace App\Domain\Staff\Http;

use App\Domain\Staff\Attendance\ClockWindow;
use App\Domain\Staff\Attendance\HoursWorked;
use App\Entity\Event;
use App\Entity\ShiftAttendance;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Enum\HoursMark;
use App\Repository\ShiftAttendanceRepository;
use App\Repository\StaffShiftRepository;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Dict;
use Psl\Iter;
use Psl\Math;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/**
 * An event's hours worked (sc-234): one row per person per shift, each time in the event's offset, and never a rate or an amount. A person removed from the roster after clocking in keeps their row, `removed`, under the id their entry had.
 *
 * @phpstan-type Correction array{field: 'in'|'out', was: ?string, by: string, at: string}
 * @phpstan-type Row array{shiftId: string, staffId: string, name: string, removed: bool, job: string, startsAt: string, endsAt: string, scheduledMinutes: int, clockedInAt: ?string, clockedOutAt: ?string, recordedInAt: ?string, recordedOutAt: ?string, workedMinutes: int, assumedMinutes: int, mark: ?string, live: string, opensAt: string, stillOn: bool, corrections: list<Correction>}
 */
final readonly class StaffHoursSerialiser
{
    public function __construct(
        private StaffShiftRepository $staffShiftRepository,
        private ShiftAttendanceRepository $shiftAttendanceRepository,
        private ClockInterface $clock,
    ) {
    }

    /** @return array<string, mixed> */
    public function page(Event $event, bool $canCorrect): array
    {
        $now = $this->clock->now();
        $zone = new DateTimeZone($event->getTimeZone());
        $shifts = Vec\sort(
            $this->staffShiftRepository->findOnEvent($event),
            static fn (StaffShift $a, StaffShift $b): int => [$a->getStartsAt(), $a->getJob()->getName()] <=> [$b->getStartsAt(), $b->getJob()->getName()],
        );
        $attendances = Dict\from_entries(Vec\map(
            $this->shiftAttendanceRepository->findOnEvent($event),
            static fn (ShiftAttendance $one): array => [HoursWorked::placeKey($one->getShift(), $one->getPersonId()->toRfc4122()), $one],
        ));
        $removed = Vec\filter($attendances, static fn (ShiftAttendance $one): bool => null === $one->getStaffMember());
        $byName = static fn (array $a, array $b): int => Str\lowercase($a['name']) <=> Str\lowercase($b['name']);
        $rows = Vec\flat_map($shifts, static fn (StaffShift $shift): array => [
            ...Vec\sort(
                Vec\map($shift->getPeople(), static fn (StaffMember $person): array => self::row($shift, $person->getId()->toRfc4122(), $person->getFullName(), $attendances[HoursWorked::placeKey($shift, $person->getId()->toRfc4122())] ?? null, $now, $zone)),
                $byName,
            ),
            ...Vec\sort(
                Vec\map(
                    Vec\filter($removed, static fn (ShiftAttendance $one): bool => $one->getShift() === $shift),
                    static fn (ShiftAttendance $one): array => self::row($shift, $one->getPersonId()->toRfc4122(), $one->name(), $one, $now, $zone),
                ),
                $byName,
            ),
        ]);
        $ends = Vec\map($shifts, static fn (StaffShift $shift): int => ClockWindow::endOf($shift)->getTimestamp());

        return [
            'timeZone' => $event->getTimeZone(),
            'now' => $now->setTimezone($zone)->format(\DATE_ATOM),
            'live' => [] !== $ends && $now->getTimestamp() < Math\max($ends),
            'canCorrect' => $canCorrect,
            'rows' => $rows,
            'summary' => [
                'workedMinutes' => Iter\reduce($rows, static fn (int $sum, array $row): int => $sum + $row['workedMinutes'], 0),
                'scheduledMinutes' => Iter\reduce($rows, static fn (int $sum, array $row): int => $sum + $row['scheduledMinutes'], 0),
                'assumedMinutes' => Iter\reduce($rows, static fn (int $sum, array $row): int => $sum + $row['assumedMinutes'], 0),
                'noAttendance' => Iter\count(Vec\filter($rows, static fn (array $row): bool => HoursMark::NoAttendance->value === $row['mark'])),
                'clockedIn' => Iter\count(Vec\filter($rows, static fn (array $row): bool => 'in' === $row['live'] || 'out' === $row['live'])),
                'total' => Iter\count($rows),
            ],
        ];
    }

    /** @return Row */
    private static function row(StaffShift $shift, string $personId, string $name, ?ShiftAttendance $attendance, DateTimeImmutable $now, DateTimeZone $zone): array
    {
        $at = static fn (?DateTimeImmutable $instant): ?string => $instant?->setTimezone($zone)->format(\DATE_ATOM);
        $in = $attendance?->countedIn();
        $out = $attendance?->countedOut();
        $end = ClockWindow::endOf($shift);
        $removed = null !== $attendance && null === $attendance->getStaffMember();
        $worked = HoursWorked::of($shift->getJob()->getId()->toRfc4122(), $personId, $end, $in, $out, $now);

        return [
            'shiftId' => $shift->getId()->toRfc4122(),
            'staffId' => $personId,
            'name' => $name,
            'removed' => $removed,
            'job' => $shift->getJob()->getName(),
            'startsAt' => $at(ClockWindow::startOf($shift)) ?? '',
            'endsAt' => $at($end) ?? '',
            'scheduledMinutes' => Math\div(Math\maxva(0, $end->getTimestamp() - ClockWindow::startOf($shift)->getTimestamp()), 60),
            'clockedInAt' => $at($in),
            'clockedOutAt' => $at($out),
            'recordedInAt' => $at($attendance?->getClockedInAt()),
            'recordedOutAt' => $at($attendance?->getClockedOutAt()),
            'workedMinutes' => $worked->minutes,
            'assumedMinutes' => $worked->assumedMinutes,
            'mark' => $worked->mark?->value,
            'live' => match (true) {
                null !== $in && null === $out => 'in',
                null !== $in => 'out',
                $now < ClockWindow::opensAt($shift) => 'later',
                default => 'not_yet',
            },
            'opensAt' => $at(ClockWindow::opensAt($shift)) ?? '',
            'stillOn' => !$removed && ClockWindow::stillOn($shift, $attendance, $now),
            'corrections' => null === $attendance ? [] : self::corrections($attendance, $at),
        ];
    }

    /**
     * @param callable(?DateTimeImmutable): ?string $at
     *
     * @return list<Correction>
     */
    private static function corrections(ShiftAttendance $attendance, callable $at): array
    {
        $in = $attendance->getCorrectedInAt();
        $out = $attendance->getCorrectedOutAt();

        return [
            ...(null === $in ? [] : [['field' => 'in', 'was' => $at($attendance->getClockedInAt()), 'by' => $attendance->getInCorrectedBy() ?? '', 'at' => $at($attendance->getInCorrectedOn()) ?? '']]),
            ...(null === $out ? [] : [['field' => 'out', 'was' => $at($attendance->getClockedOutAt()), 'by' => $attendance->getOutCorrectedBy() ?? '', 'at' => $at($attendance->getOutCorrectedOn()) ?? '']]),
        ];
    }
}
