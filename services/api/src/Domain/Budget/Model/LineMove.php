<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

/** A line a what-if moves (sc-86): its heads or count at both ends of the range, before and after, and its cost; unknown when it has no price yet. */
final readonly class LineMove
{
    public function __construct(
        public LineCost $now,
        public LineCost $then,
        public int $potentialCountNow,
        public int $potentialCountThen,
        public bool $known,
    ) {
    }
}
