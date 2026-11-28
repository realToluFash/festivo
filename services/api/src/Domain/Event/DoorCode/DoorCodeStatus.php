<?php

declare(strict_types=1);

namespace App\Domain\Event\DoorCode;

/** What a door code's card says (sc-72): stopped wins over expired, and expired over full. */
enum DoorCodeStatus: string
{
    case Working = 'working';
    case Full = 'full';
    case Stopped = 'stopped';
    case Expired = 'expired';
}
