<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use App\Entity\BudgetLine;

/** A line priced at both ends of the range, in the event currency's minor unit; a line waiting for its price is 0 at both. */
final readonly class LineCost
{
    public function __construct(
        public BudgetLine $line,
        public Quantity $quantity,
        public int $confirmedMinor,
        public int $potentialMinor,
    ) {
    }
}
