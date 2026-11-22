<?php

declare(strict_types=1);

namespace App\Enum;

/** A subscription's plan; what it allows is in the plan catalogue (sc-3928), never here. */
enum Plan: string
{
    case Free = 'free';
    case Enterprise = 'enterprise';
}
