<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use App\Enum\CostBasis;
use App\Enum\CostCategory;

/** A budget line as sent, checked: the price in the event currency's minor unit, null exactly when the basis is staff time. */
final readonly class LineDetails
{
    public function __construct(
        public string $label,
        public CostCategory $category,
        public CostBasis $basis,
        public ?int $priceMinor,
        public ?string $note,
    ) {
    }
}
