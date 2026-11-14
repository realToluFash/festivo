<?php

declare(strict_types=1);

namespace App\Enum;

/** Where a guest's reply was given, so the host's list can say so (sc-1291 adds the email and SMS links). */
enum GuestReplySource: string
{
    case GuestPage = 'guestPage';
}
