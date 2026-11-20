<?php

declare(strict_types=1);

namespace App\Enum;

/** Which of an organisation's two provider rows this is: the newest saved, or the one still signing people in while it waits (sc-610 #679). */
enum SsoStanding: string
{
    case Current = 'current';
    case Staying = 'staying';
}
