<?php

declare(strict_types=1);

namespace App\Enum;

/** What may be done to an event, as /event-states.json names it. EditSchedule is a change to the start, end or time zone; Edit, to anything else. */
enum EventAction: string
{
    case Edit = 'edit';
    case EditSchedule = 'edit_schedule';
    case Delete = 'delete';
    case MakeLive = 'make_live';
    case Pause = 'pause';
    case End = 'end';
    case Invite = 'invite';
    case Message = 'message';
    case CheckIn = 'check_in';
    case Service = 'service';
}
