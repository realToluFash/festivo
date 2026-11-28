<?php

declare(strict_types=1);

namespace App\Enum;

/** Where a guest's reply was given, so the host's list can say so. An answer link in the invitation email is its own source (sc-1291); the text's link and the plain link are the page. */
enum GuestReplySource: string
{
    case GuestPage = 'guestPage';
    case Host = 'host';
    case EmailLink = 'emailLink';
}
