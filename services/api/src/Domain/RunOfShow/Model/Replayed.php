<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Model;

/** What replaying an event's presses leaves: each item's state by its id, and each press that changed nothing by the press's id. */
final readonly class Replayed
{
    /**
     * @param array<string, ItemRun>   $runs
     * @param array<string, PressLoss> $losses
     */
    public function __construct(
        public array $runs,
        public array $losses,
    ) {
    }
}
