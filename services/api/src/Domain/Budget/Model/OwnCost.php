<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

/** One person on their own rate instead of their job's, and what their own shifts cost at it. */
final readonly class OwnCost
{
    public function __construct(
        public string $person,
        public string $job,
        public PayRate $rate,
        public int $minutes,
        public int $costMinor,
    ) {
    }
}
