<?php

declare(strict_types=1);

namespace App\Domain\Guest\Interfaces;

use App\Entity\Guest;
use App\Entity\User;

/** What else a guest's arrival starts, told once it is stored: an order for each course already fired at their table (sc-4005). */
interface ArrivalFollowerInterface
{
    public function arrived(Guest $guest, User $by): void;
}
