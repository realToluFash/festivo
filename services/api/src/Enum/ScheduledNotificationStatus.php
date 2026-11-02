<?php

declare(strict_types=1);

namespace App\Enum;

enum ScheduledNotificationStatus: string
{
    case Pending = 'pending';
    case FannedOut = 'fanned_out';
    case Cancelled = 'cancelled';
    case TooLate = 'too_late';
    case Failed = 'failed';
}
