<?php

declare(strict_types=1);

namespace App\Enum;

/** An event's stored state, as /event-states.json declares it; what the clock makes of it is its EventPhase (sc-3584). */
enum EventStatus: string
{
    case Draft = 'draft';
    case Live = 'live';
    case Paused = 'paused';
    case Ended = 'ended';
}
