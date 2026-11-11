<?php

declare(strict_types=1);

namespace App\Http\Access;

use Attribute;

/** A controller argument loaded within the route's event, from the route parameter named here. */
#[Attribute(Attribute::TARGET_PARAMETER)]
final readonly class InThisEvent
{
    public function __construct(
        public string $parameter,
    ) {
    }
}
