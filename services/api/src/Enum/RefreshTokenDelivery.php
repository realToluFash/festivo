<?php

declare(strict_types=1);

namespace App\Enum;

/**
 * Where a client asks for its refresh token to be carried.
 *
 * A browser asks for Cookie: a value the page cannot read survives a cross-site
 * script that reads everything the page can. A native client asks for Body and
 * keeps the token in the Keychain, which is better than any cookie and brings
 * no cross-site request forgery to answer for.
 */
enum RefreshTokenDelivery: string
{
    case Body = 'body';
    case Cookie = 'cookie';
}
