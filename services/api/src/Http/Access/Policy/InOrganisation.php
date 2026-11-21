<?php

declare(strict_types=1);

namespace App\Http\Access\Policy;

use App\Enum\Permission;
use App\Enum\PlanFeature;
use Attribute;

/** An active member of the organisation in the route, holding the permission, or with `orOnAnEvent` holding it on any one event; with none named, any active member. With `feature`, a change also needs the plan to unlock it (sc-581), and with `featureLocksReading` a read does too (sc-611). */
#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_METHOD)]
final readonly class InOrganisation implements Policy
{
    public function __construct(
        public ?Permission $permission,
        public string $parameter = 'organisationId',
        public bool $orOnAnEvent = false,
        public ?PlanFeature $feature = null,
        public bool $featureLocksReading = false,
    ) {
    }
}
