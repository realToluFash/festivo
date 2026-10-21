<?php

declare(strict_types=1);

namespace App\Enum;

/** What an organiser or the night's staff may do to an event, as /event-states.json names them. */
enum EventAction: string
{
    case Edit = 'edit';
    case Delete = 'delete';
    case MakeLive = 'make_live';
    case Pause = 'pause';
    case End = 'end';
    case Invite = 'invite';
    case Message = 'message';
    case CheckIn = 'check_in';
    case Service = 'service';
}
