<?php

declare(strict_types=1);

namespace App\Http\Access\Policy;

use App\Enum\Permission;
use Attribute;

/** An active member of the organisation in the route, holding the permission, or with `orOnAnEvent` holding it on any one event; with none named, any active member. */
#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_METHOD)]
final readonly class InOrganisation implements Policy
{
    public function __construct(
        public ?Permission $permission,
        public string $parameter = 'organisationId',
        public bool $orOnAnEvent = false,
    ) {
    }
}
