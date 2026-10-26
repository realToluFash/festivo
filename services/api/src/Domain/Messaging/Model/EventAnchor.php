<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

/** What a trigger counts from. Only the event's own dates move with it; a caller's date is the caller's to move. */
enum EventAnchor: string
{
    case Date = 'date';
    case EventStart = 'event_start';
    case EventEnd = 'event_end';
}
