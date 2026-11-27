<?php

declare(strict_types=1);

namespace App\Enum;

/** Whether a service's heartbeat runs (sc-4028), so a device knows when silence on the stream counts. */
enum ServicePhase: string
{
    case NotStarted = 'notStarted';
    case On = 'on';
    case Ended = 'ended';
}
