<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

/** One job's hours worked and what they cost at its rates (sc-234); `people` is how many worked it, `costMinor` null while it has no rate. */
final readonly class JobWorked
{
    public function __construct(
        public string $job,
        public int $minutes,
        public int $assumedMinutes,
        public int $noAttendance,
        public int $people,
        public ?int $costMinor,
    ) {
    }
}
