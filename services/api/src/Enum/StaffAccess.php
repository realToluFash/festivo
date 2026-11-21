<?php

declare(strict_types=1);

namespace App\Enum;

/** What a job's people may do on its event through their accounts (sc-71, sc-4002), always below editing the event. */
enum StaffAccess: string
{
    case View = 'view';
    case CheckIn = 'check_in';
    case Floor = 'floor';
    case Pass = 'pass';
    case Run = 'run';
}
