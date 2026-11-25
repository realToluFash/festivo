<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use App\Enum\ChargeSource;

/** A line's cost and what the client is charged for it, at both ends of the range, in the minor unit; `markupTenths` is null for a price of its own. */
final readonly class LineCharge
{
    public function __construct(
        public LineCost $cost,
        public MarginFigures $figures,
        public ChargeSource $source,
        public ?int $markupTenths,
    ) {
    }
}
