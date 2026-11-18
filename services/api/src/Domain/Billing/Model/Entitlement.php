<?php

declare(strict_types=1);

namespace App\Domain\Billing\Model;

use App\Enum\Plan;
use App\Enum\PlanFeature;

/** What an organisation may do, from its subscription's plan; sc-3928's catalogue later stands behind it without its callers changing. */
final readonly class Entitlement
{
    public function __construct(
        public Plan $plan,
    ) {
    }

    public function unlocks(PlanFeature $feature): bool
    {
        return $this->plan->unlocks($feature);
    }
}
