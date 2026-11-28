<?php

declare(strict_types=1);

namespace App\Enum;

/** What the waiter marks for one item of a plate at its stop (sc-4005). Bring after is Not on, sent without it. */
enum ItemMark: string
{
    case On = 'on';
    case NotOn = 'notOn';
    case BringAfter = 'bringAfter';
}
