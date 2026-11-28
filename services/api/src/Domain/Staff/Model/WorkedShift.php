<?php

declare(strict_types=1);

namespace App\Domain\Staff\Model;

use App\Enum\HoursMark;

/** One person's hours on one shift: `assumedMinutes` were counted to the scheduled end because nobody clocked out. */
final readonly class WorkedShift
{
    public function __construct(
        public string $job,
        public string $person,
        public int $minutes,
        public int $assumedMinutes,
        public ?HoursMark $mark,
    ) {
    }

    public function worked(): bool
    {
        return HoursMark::NoAttendance !== $this->mark && $this->minutes > 0;
    }
}
