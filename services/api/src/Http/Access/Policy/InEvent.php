<?php

declare(strict_types=1);

namespace App\Http\Access\Policy;

use App\Enum\Permission;
use App\Enum\PlanFeature;
use Attribute;

/** The event in the route is resolved first, and every other id in the route through it. With `feature`, a change also needs the event's organisation's plan to unlock it (sc-87), and with `featureLocksReading` a read does too (sc-92). */
#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_METHOD)]
final readonly class InEvent implements Policy
{
    public function __construct(
        public Permission $permission,
        public string $parameter = 'eventId',
        public ?PlanFeature $feature = null,
        public bool $featureLocksReading = false,
    ) {
    }
}
