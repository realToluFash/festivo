<?php

declare(strict_types=1);

namespace App\Enum;

/** Why a guest is owed a plate (sc-4005). */
enum OwedReason: string
{
    case BringAfter = 'bringAfter';
    case ToFollow = 'toFollow';
    case SentBack = 'sentBack';
}
