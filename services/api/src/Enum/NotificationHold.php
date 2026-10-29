<?php

declare(strict_types=1);

namespace App\Enum;

/** Why a due delivery is waiting on purpose, so the alert does not count it as stuck. Quiet hours and credits join with their stories. */
enum NotificationHold: string
{
    case Paused = 'paused';
    case Deleted = 'deleted';
}
