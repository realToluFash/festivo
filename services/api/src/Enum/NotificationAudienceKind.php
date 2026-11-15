<?php

declare(strict_types=1);

namespace App\Enum;

enum NotificationAudienceKind: string
{
    case Guest = 'guest';
    case Member = 'member';
    case Staff = 'staff';
    /** One person at the address they were written to when it was queued: an account or security email (sc-4332). */
    case Person = 'person';
}
