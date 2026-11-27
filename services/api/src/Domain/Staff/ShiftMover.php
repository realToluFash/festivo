<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Audit\Auditor;
use App\Domain\Event\LocalTimeResolver;
use App\Domain\Event\WallDays;
use App\Entity\Event;
use App\Entity\ShiftAttendance;
use App\Entity\StaffShift;
use App\Entity\User;
use App\Enum\Actor;
use App\Repository\ShiftAttendanceRepository;
use App\Repository\StaffShiftRepository;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** An event moved to another day takes its shifts with it, by whole days at the times as entered (sc-100276). */
final readonly class ShiftMover
{
    public function __construct(
        private StaffShiftRepository $staffShiftRepository,
        private ShiftAttendanceRepository $shiftAttendanceRepository,
        private Auditor $auditor,
        private ClockInterface $clock,
    ) {
    }

    /**
     * A shift already started, or with anyone's clock-in, stays. The caller holds the event's lock and flushes.
     *
     * @param DateTimeZone $zone the one the event had before the save, in which a shift has or has not started
     */
    public function move(Event $event, DateTimeImmutable $startedOn, DateTimeImmutable $startsOn, DateTimeZone $zone, User $by): void
    {
        $days = WallDays::between($startedOn, $startsOn);

        if (0 === $days) {
            return;
        }

        $now = $this->clock->now();
        $worked = Vec\map(
            Vec\filter($this->shiftAttendanceRepository->findOnEvent($event), static fn (ShiftAttendance $one): bool => $one->worked()),
            static fn (ShiftAttendance $one): string => $one->getShift()->getId()->toRfc4122(),
        );
        $moving = Vec\filter(
            $this->staffShiftRepository->findOnEvent($event),
            static fn (StaffShift $shift): bool => LocalTimeResolver::resolve($shift->getStartsAt(), $zone) > $now && !Iter\contains($worked, $shift->getId()->toRfc4122()),
        );
        $shifted = Str\format('%+d days', $days);

        foreach ($moving as $shift) {
            $startsAt = $shift->getStartsAt()->modify($shifted);
            $endsAt = $shift->getEndsAt()->modify($shifted);
            $this->auditor->record(StaffPlan::SHIFT_EDITED, 'StaffShift', $shift->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(
                self::recorded($shift->getStartsAt(), $shift->getEndsAt()),
                self::recorded($startsAt, $endsAt),
            ));
            $shift->setStartsAt($startsAt);
            $shift->setEndsAt($endsAt);
        }
    }

    /** @return array{startsAt: string, endsAt: string} */
    private static function recorded(DateTimeImmutable $startsAt, DateTimeImmutable $endsAt): array
    {
        return ['startsAt' => $startsAt->format('Y-m-d\TH:i'), 'endsAt' => $endsAt->format('Y-m-d\TH:i')];
    }
}
