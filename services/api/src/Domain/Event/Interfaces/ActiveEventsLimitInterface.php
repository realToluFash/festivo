<?php

declare(strict_types=1);

namespace App\Domain\Event\Interfaces;

use App\Domain\Event\Model\PlanLimit;
use App\Entity\Organisation;

/** The plan's active-events limit, consulted before an event is made live. Billing provides the number (sc-581). */
interface ActiveEventsLimitInterface
{
    /** Null while the organisation's plan allows one more event to be Live or Paused. */
    public function reachedBy(Organisation $organisation): ?PlanLimit;
}
