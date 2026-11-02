<?php

declare(strict_types=1);

namespace App\Enum;

/** What a try on the current code would meet, so a screen can open on it without spending one. */
enum CodeState: string
{
    case Live = 'live';
    case Expired = 'expired';
    case Exhausted = 'exhausted';
}
