<?php

declare(strict_types=1);

namespace App\Enum;

/** How a limit behaves at its boundary, as docs/architecture/billing.md names them (sc-3928). */
enum LimitKind: string
{
    /** Refused at creation (sc-3930). */
    case Hard = 'hard';
    /** Allowed, recorded and warned on approach (sc-3931); the amount is what the month includes. */
    case Metered = 'metered';
    /** Never refused or charged; the amount is the monthly level at which support reviews it for abuse. */
    case Included = 'included';
    /** Credits the month includes (sc-3932). */
    case Credits = 'credits';
}
