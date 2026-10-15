<?php

declare(strict_types=1);

namespace App\Enum;

/**
 * Why a password was refused.
 *
 * Each case is a violation code on the password field rather than a top-level
 * error, so a form can mark the input instead of showing a banner.
 */
enum PasswordFailure: string
{
    case TooShort = 'password_too_short';
    case TooLong = 'password_too_long';

    /**
     * The only rule that cannot be checked before the person submits, because
     * answering it needs a network call.
     */
    case Breached = 'password_breached';
}
