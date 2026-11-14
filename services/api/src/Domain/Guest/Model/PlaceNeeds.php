<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

/** The needs a guest gave for a place nobody has named (sc-3778, "Your guest"), by the place's id. */
final readonly class PlaceNeeds
{
    public function __construct(
        public string $id,
        public GuestNeeds $needs,
    ) {
    }
}
