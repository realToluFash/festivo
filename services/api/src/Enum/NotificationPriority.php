<?php

declare(strict_types=1);

namespace App\Enum;

/** Stored as its rank: the worker claims the lowest first. */
enum NotificationPriority: int
{
    case Urgent = 0;
    case Normal = 1;
    case Info = 2;
}
