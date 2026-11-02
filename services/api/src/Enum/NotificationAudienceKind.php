<?php

declare(strict_types=1);

namespace App\Enum;

enum NotificationAudienceKind: string
{
    case Guest = 'guest';
    case Member = 'member';
    case Staff = 'staff';
}
