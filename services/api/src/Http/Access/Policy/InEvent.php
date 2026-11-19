<?php

declare(strict_types=1);

namespace App\Http\Access\Policy;

use App\Enum\Permission;
use App\Enum\PlanFeature;
use Attribute;

/** The event in the route is resolved first, and every other id in the route through it. With `feature`, reading needs the plan as well as changing: nothing behind it is shown locked (sc-92). */
#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_METHOD)]
final readonly class InEvent implements Policy
{
    public function __construct(
        public Permission $permission,
        public string $parameter = 'eventId',
        public ?PlanFeature $feature = null,
    ) {
    }
}
