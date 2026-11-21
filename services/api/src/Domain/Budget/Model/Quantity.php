<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use App\Enum\QuantitySource;

/** How many of a line's basis an event has, where that came from, and why it is zero when its source has nothing yet. */
final readonly class Quantity
{
    public function __construct(
        public int $count,
        public QuantitySource $source,
        public ?string $reason = null,
    ) {
    }
}
