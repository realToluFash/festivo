<?php

declare(strict_types=1);

namespace App\Tests\Double;

use Closure;
use DateInterval;
use DateTimeImmutable;
use Psr\Clock\ClockInterface;

/** Each reading a step later than the last, and `$each` told of it before it is returned: work that takes long, and a run that cuts in partway through it. */
final class SteppingClock implements ClockInterface
{
    private int $readings = 0;

    /** @param Closure(int, DateTimeImmutable): void $each given the reading's number, from 1, and the time read */
    public function __construct(
        private readonly DateTimeImmutable $start,
        private readonly string $step,
        private readonly Closure $each,
    ) {
    }

    public function now(): DateTimeImmutable
    {
        $now = $this->start;

        for ($taken = 0; $taken < $this->readings; ++$taken) {
            $now = $now->add(new DateInterval($this->step));
        }

        ++$this->readings;
        ($this->each)($this->readings, $now);

        return $now;
    }
}
