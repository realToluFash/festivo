<?php

declare(strict_types=1);

namespace App\Domain\Guest\Interfaces;

use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\User;
use Closure;

/** What else a guest's arrival, or its undo, starts: an order for each course already fired at their table, and, once any course is fired, the service's reads patched from before it (sc-4005). */
interface ArrivalFollowerInterface
{
    /** @param Closure(): Guest $arrival stores the arrival or its undo */
    public function arrival(Event $event, User $by, Closure $arrival): Guest;
}
