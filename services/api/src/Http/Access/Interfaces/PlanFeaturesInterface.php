<?php

declare(strict_types=1);

namespace App\Http\Access\Interfaces;

use App\Enum\PlanFeature;
use Symfony\Component\Uid\Uuid;

/** Whether an organisation's plan switches a feature on, for a module that shows it differently rather than refusing a route (sc-87). */
interface PlanFeaturesInterface
{
    public function unlocks(Uuid $organisationId, PlanFeature $feature): bool;
}
