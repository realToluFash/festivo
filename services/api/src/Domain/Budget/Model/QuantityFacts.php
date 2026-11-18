<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

/** What an event already knows that a basis counts, read once; null where the area holding it has nothing yet. */
final readonly class QuantityFacts
{
    public function __construct(
        public int $accepted,
        public ?int $seatingTables,
        public ?int $staffHours,
        public int $eventDays,
    ) {
    }
}
