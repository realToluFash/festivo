<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

/** What an event already knows that a basis counts, read once; null where the area holding it has nothing yet. `ifAllCome` is the heads a per-head line has if everybody who has not said Not coming comes (sc-84). */
final readonly class QuantityFacts
{
    public function __construct(
        public int $onList,
        public int $accepted,
        public ?int $seatingTables,
        public ?int $staffHours,
        public int $eventDays,
        public int $ifAllCome,
    ) {
    }
}
