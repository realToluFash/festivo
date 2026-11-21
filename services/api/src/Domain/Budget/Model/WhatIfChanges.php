<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

/** The hypothetical changes of one what-if (sc-86), each kind added together, applied to the facts they would move. */
final readonly class WhatIfChanges
{
    public function __construct(
        public int $guests,
        public int $tables,
        public int $staffHours,
        public int $days,
    ) {
    }

    /** An added guest has not replied, so they join the list and the upper figure's heads and leave the accepted count as it is. */
    public function applyTo(QuantityFacts $facts): QuantityFacts
    {
        return new QuantityFacts(
            $facts->onList + $this->guests,
            $facts->accepted,
            0 === $this->tables ? $facts->seatingTables : ($facts->seatingTables ?? 0) + $this->tables,
            0 === $this->staffHours ? $facts->staffHours : ($facts->staffHours ?? 0) + $this->staffHours,
            $facts->eventDays + $this->days,
            $facts->ifAllCome + $this->guests,
            $facts->staffCostMinor,
        );
    }
}
