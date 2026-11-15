<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Domain\Event\Interfaces\ActiveEventsLimitInterface;
use App\Domain\Event\Model\PlanLimit;
use App\Entity\Organisation;

/** Allows everything, as the product does until sc-581, unless a test reaches the limit; counts how often it was asked. */
final class ScriptedActiveEventsLimit implements ActiveEventsLimitInterface
{
    public int $consulted = 0;

    private ?PlanLimit $reached = null;

    public function reach(string $plan, int $limit): void
    {
        $this->reached = new PlanLimit($plan, $limit);
    }

    public function reachedBy(Organisation $organisation): ?PlanLimit
    {
        ++$this->consulted;

        return $this->reached;
    }
}
