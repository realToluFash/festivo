<?php

declare(strict_types=1);

namespace App\Http\Access\Policy;

use App\Enum\Permission;
use App\Enum\PlanFeature;
use Attribute;

/** The event in the route is resolved first, and every other id in the route through it. With `feature`, a change also needs the event's organisation's plan to unlock it (sc-87), and with `featureLocksReading` a read does too (sc-92). With `endedLink`, an account whose staff link on the event ended only because the event did is answered 409 `event_concluded` with that message, not 404 (sc-3918). */
#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_METHOD)]
final readonly class InEvent implements Policy
{
    public function __construct(
        public Permission $permission,
        public string $parameter = 'eventId',
        public ?PlanFeature $feature = null,
        public bool $featureLocksReading = false,
        public ?string $endedLink = null,
    ) {
    }
}
