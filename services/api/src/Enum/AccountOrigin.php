<?php

declare(strict_types=1);

namespace App\Enum;

/** How an account came to exist: one that registered on its own founds an organisation; an invited one joins. */
enum AccountOrigin: string
{
    case SelfRegistered = 'self_registered';
    case Invitation = 'invitation';
}
