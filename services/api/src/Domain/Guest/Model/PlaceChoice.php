<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

/** A place nobody has named as the guest left it (sc-48740): Coming or Not coming, by the place's id, with its needs (sc-3778), null to leave them as they are. */
final readonly class PlaceChoice
{
    public function __construct(
        public string $id,
        public bool $coming,
        public ?GuestNeeds $needs = null,
    ) {
    }
}
