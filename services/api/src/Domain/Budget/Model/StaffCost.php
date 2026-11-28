<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use Psl\Vec;

/** Staff rates' headline, which the budget's staff-time line is (sc-101): the total of every job with a rate, and the scheduled hours of those without one. */
final readonly class StaffCost
{
    /**
     * @param list<JobCost>      $jobs
     * @param list<OwnCost>      $own
     * @param array<string, int> $minutesOf each person's scheduled minutes on their own shifts
     */
    public function __construct(
        public int $totalMinor,
        public int $countedMinutes,
        public int $scheduledMinutes,
        public array $jobs,
        public array $own,
        public array $minutesOf,
    ) {
    }

    /** @return list<JobCost> */
    public function unrated(): array
    {
        return Vec\filter($this->jobs, static fn (JobCost $job): bool => null === $job->rate && $job->scheduledMinutes > 0);
    }
}
