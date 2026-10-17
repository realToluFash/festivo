<?php

declare(strict_types=1);

namespace App\Enum;

/** Who can vouch for a person instead of a password. */
enum IdentityProvider: string
{
    case Google = 'google';
    case Apple = 'apple';
}
