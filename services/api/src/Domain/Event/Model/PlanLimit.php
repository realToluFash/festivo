<?php

declare(strict_types=1);

namespace App\Domain\Event\Model;

/** The plan's cap on events that are Live or Paused at once, named in the refusal when making one more live would pass it. */
final readonly class PlanLimit
{
    public function __construct(
        public string $plan,
        public int $limit,
    ) {
    }
}
