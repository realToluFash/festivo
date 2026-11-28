<?php

declare(strict_types=1);

namespace App\Enum;

/** Where a person's clock card stands on one shift (sc-234). */
enum ClockPhase: string
{
    case Before = 'before';
    case Ready = 'ready';
    case On = 'on';
    case Off = 'off';
    case Closed = 'closed';
}
