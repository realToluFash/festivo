<?php

declare(strict_types=1);

namespace App\Enum;

/** What somebody did to an event that its other members are told of (sc-13214). Edited is a change to its date, a time, its zone or its venue. */
enum EventChangeKind: string
{
    case MadeLive = 'made_live';
    case Paused = 'paused';
    case Resumed = 'resumed';
    case CalledOff = 'called_off';
    case Ended = 'ended';
    case Deleted = 'deleted';
    case Restored = 'restored';
    case Edited = 'edited';

    /** Told at once, where an edit settles for 15 minutes first. */
    public function isAction(): bool
    {
        return self::Edited !== $this;
    }
}
