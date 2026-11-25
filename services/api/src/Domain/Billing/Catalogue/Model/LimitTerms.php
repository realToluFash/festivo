<?php

declare(strict_types=1);

namespace App\Domain\Billing\Catalogue\Model;

use App\Enum\LimitKind;

/** One line of a plan's terms: its kind, and the amount that kind reads (included, a cap, or a review level). */
final readonly class LimitTerms
{
    public function __construct(
        public LimitKind $kind,
        public Allowance $allowance,
    ) {
    }
}
