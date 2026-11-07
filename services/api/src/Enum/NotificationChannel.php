<?php

declare(strict_types=1);

namespace App\Enum;

/** Where a notification can reach somebody. Push only ever rides along with another channel (epic 36, §5). */
enum NotificationChannel: string
{
    case InApp = 'in_app';
    case Push = 'push';
    case Email = 'email';
}
