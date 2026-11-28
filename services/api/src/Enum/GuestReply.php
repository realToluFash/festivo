<?php

declare(strict_types=1);

namespace App\Enum;

/** A guest's own reply (sc-1439 sets it); a companion has none. The wire names are the clients'. */
enum GuestReply: string
{
    case NoReply = 'noReply';
    case Coming = 'coming';
    case Maybe = 'maybe';
    case NotComing = 'notComing';
}
