<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use Psl\Iter;
use Psl\Math;

/** One shift as Staff rates counts it: its job, its length on the event's clock, the places it needs and who has taken them. */
final readonly class ScheduledShift
{
    /** @param list<string> $people */
    public function __construct(
        public string $job,
        public int $minutes,
        public int $needed,
        public array $people,
    ) {
    }

    public function openPlaces(): int
    {
        return Math\maxva(0, $this->needed - Iter\count($this->people));
    }
}
