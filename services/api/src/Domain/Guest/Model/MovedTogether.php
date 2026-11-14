<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

use App\Entity\GuestGroup;

/** What one Add to group on many guests did (sc-3776): `already` were in the group before, `gone` were not on the list to move, removed by someone else included. */
final readonly class MovedTogether
{
    public function __construct(
        public GuestGroup $group,
        public int $moved,
        public int $already,
        public int $gone,
    ) {
    }
}
