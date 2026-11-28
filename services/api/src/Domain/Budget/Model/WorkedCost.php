<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

/** The worked side of Staff rates after the event (sc-234); it never replaces the scheduled headline. */
final readonly class WorkedCost
{
    /**
     * @param list<JobWorked> $jobs
     * @param list<OwnWorked> $own
     */
    public function __construct(
        public int $totalMinor,
        public int $minutes,
        public int $assumedMinutes,
        public int $noAttendance,
        public array $jobs,
        public array $own,
    ) {
    }
}
