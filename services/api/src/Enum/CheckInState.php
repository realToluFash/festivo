<?php

declare(strict_types=1);

namespace App\Enum;

/** What the door may do now (sc-1454): before it opens search works and nothing is recorded; once the event is concluded the arrivals read only. */
enum CheckInState: string
{
    case BeforeOpen = 'before_open';
    case Open = 'open';
    case Ended = 'ended';
}
