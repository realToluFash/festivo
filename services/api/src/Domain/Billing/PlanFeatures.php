<?php

declare(strict_types=1);

namespace App\Domain\Billing;

use App\Enum\PlanFeature;
use App\Http\Access\Interfaces\PlanFeaturesInterface;
use Symfony\Component\Uid\Uuid;

final readonly class PlanFeatures implements PlanFeaturesInterface
{
    public function __construct(
        private Entitlements $entitlements,
    ) {
    }

    public function unlocks(Uuid $organisationId, PlanFeature $feature): bool
    {
        return $this->entitlements->of($organisationId)->unlocks($feature);
    }
}
