<?php

declare(strict_types=1);

namespace App\Domain\Service\Model;

use App\Enum\ItemState;
use App\Enum\PlateStage;

/** What a service write saw when its tap was made (sc-4028): each plate it acts on, or that it saw on the tray, at its stage; or a station item at its state. */
final readonly class Expected
{
    /** @param array<string, PlateStage>|null $plates by plate id */
    public function __construct(
        public ?array $plates = null,
        public ?ItemState $item = null,
    ) {
    }
}
