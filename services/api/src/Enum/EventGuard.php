<?php

declare(strict_types=1);

namespace App\Enum;

/** A condition a transition in /event-states.json names, checked before the event moves. */
enum EventGuard: string
{
    case EndNotPassed = 'end_not_passed';
    case PlanLimit = 'plan_limit';
    case PhaseAllows = 'phase_allows';
}
