<?php

declare(strict_types=1);

namespace App\Enum;

/** How an account came to exist: one that registered on its own founds an organisation; an invited one joins; a door code's was held by the device that redeemed it (sc-72), before sc-4235; a staff account is a name and a mobile number proved by one code (sc-4235). */
enum AccountOrigin: string
{
    case SelfRegistered = 'self_registered';
    case Invitation = 'invitation';
    case DoorCode = 'door_code';
    case Staff = 'staff';
}
