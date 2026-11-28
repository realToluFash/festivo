<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

use App\Enum\GuestStanding;

/** One person on the list as sc-99 counts them: where their reply puts them, and whether they have arrived (sc-1454). */
final readonly class CountedPerson
{
    public function __construct(
        public GuestStanding $standing,
        public bool $arrived = false,
    ) {
    }
}
