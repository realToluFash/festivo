<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

/** One job's scheduled hours and what they cost; `costMinor` is null while it has no rate, and then it is not counted. */
final readonly class JobCost
{
    /**
     * @param list<string> $people   everybody on its shifts
     * @param list<string> $paidOnce people on more than one of its shifts
     * @param list<string> $keepOwn  people on its shifts paid their own rate instead
     */
    public function __construct(
        public string $job,
        public ?PayRate $rate,
        public int $scheduledMinutes,
        public int $shifts,
        public int $openPlaces,
        public array $people,
        public ?int $costMinor,
        public int $rateMinutes,
        public int $fees,
        public array $paidOnce,
        public array $keepOwn,
    ) {
    }
}
