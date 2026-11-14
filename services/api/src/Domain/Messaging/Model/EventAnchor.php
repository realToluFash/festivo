<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

/** What a trigger counts from. A caller's day follows the event's zone, never its dates; a moment follows nothing. */
enum EventAnchor: string
{
    case Moment = 'moment';
    case Date = 'date';
    case EventStart = 'event_start';
    case EventEnd = 'event_end';
}
