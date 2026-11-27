<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Event\EventVenue;
use App\Domain\Staff\ShiftNotice\Model\ShiftTold;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Repository\StaffShiftRepository;
use DateTimeZone;
use Psl\Dict;

/** How a person's shifts, job, date and venue stand now, in the form a change notice compares with what they were told. */
final readonly class ShiftSnapshots
{
    private const string WALL = 'Y-m-d H:i';

    public function __construct(
        private StaffShiftRepository $staffShiftRepository,
    ) {
    }

    /** @param ?list<StaffShift> $shifts the person's shifts, read when null */
    public function of(StaffMember $entry, ?array $shifts = null): ShiftTold
    {
        $event = $entry->getEvent();
        $times = [];

        foreach ($shifts ?? $this->staffShiftRepository->findOfPerson($entry) as $shift) {
            $times[$shift->getId()->toRfc4122()] = [$shift->getStartsAt()->format(self::WALL), $shift->getEndsAt()->format(self::WALL)];
        }

        $job = $entry->getJob();

        return new ShiftTold(
            Dict\sort_by_key($times),
            null === $job ? null : [$job->getId()->toRfc4122(), $job->getName()],
            $event->getStartsAt()->setTimezone(new DateTimeZone($event->getTimeZone()))->format('Y-m-d'),
            EventVenue::of($event)?->name,
        );
    }
}
