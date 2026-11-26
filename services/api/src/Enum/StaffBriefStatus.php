<?php

declare(strict_types=1);

namespace App\Enum;

/** How far a person's briefing got (sc-3917). Changed since sent is not stored: it is a briefed person whose briefing no longer matches what they were given. */
enum StaffBriefStatus: string
{
    case None = 'none';
    case Sent = 'sent';
    case Read = 'read';
}
