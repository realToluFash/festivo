<?php

declare(strict_types=1);

namespace App\Enum;

/** How a guest reached the list, kept on their audit entry so the share picked from a phone's contacts can be counted (sc-7579). */
enum GuestSource: string
{
    case Typed = 'typed';
    case Contacts = 'contacts';
}
