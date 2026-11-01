<?php

declare(strict_types=1);

namespace App\Enum;

/** Why a due delivery is waiting on purpose, so the alert does not count it as stuck. Credits join with their story. */
enum NotificationHold: string
{
    case Paused = 'paused';
    case Deleted = 'deleted';
    /** Kept past the morning so a member's new time zone can find the held push, and the alert counts it as waiting from then; the unread check runs on every push regardless (sc-20494). */
    case QuietHours = 'quiet_hours';
}
