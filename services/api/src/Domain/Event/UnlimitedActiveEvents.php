<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Domain\Event\Interfaces\ActiveEventsLimitInterface;
use App\Domain\Event\Model\PlanLimit;
use App\Entity\Organisation;

/** Every plan allows any number of active events until billing has entitlements (sc-581). */
final readonly class UnlimitedActiveEvents implements ActiveEventsLimitInterface
{
    public function reachedBy(Organisation $organisation): ?PlanLimit
    {
        return null;
    }
}
