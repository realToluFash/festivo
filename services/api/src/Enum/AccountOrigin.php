<?php

declare(strict_types=1);

namespace App\Enum;

/** How an account came to exist: one that registered on its own founds an organisation; an invited one joins; a door code's is held by the device that redeemed it (sc-72) until sc-4235 proves a number for it. */
enum AccountOrigin: string
{
    case SelfRegistered = 'self_registered';
    case Invitation = 'invitation';
    case DoorCode = 'door_code';
}
