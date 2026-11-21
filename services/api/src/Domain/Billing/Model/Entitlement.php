<?php

declare(strict_types=1);

namespace App\Domain\Billing\Model;

use App\Domain\Billing\Catalogue\Model\PlanTerms;
use App\Enum\Plan;
use App\Enum\PlanFeature;

/** What an organisation may do: its plan's terms in the catalogue version its subscription was sold on (sc-3927, sc-3928). */
final readonly class Entitlement
{
    public Plan $plan;

    public function __construct(
        public PlanTerms $terms,
    ) {
        $this->plan = $terms->plan;
    }

    public function unlocks(PlanFeature $feature): bool
    {
        return $this->terms->unlocks($feature);
    }
}
