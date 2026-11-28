<?php

declare(strict_types=1);

namespace App\Enum;

/** Where a guest's reply was given, so the host's list can say so: their page, a host, or one of the invitation email's answer links (sc-1291). */
enum GuestReplySource: string
{
    case GuestPage = 'guestPage';
    case Host = 'host';
    case EmailLink = 'emailLink';
}
