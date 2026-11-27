<?php

declare(strict_types=1);

namespace App\Enum;

/** The two halves of a service (sc-4002): the floor is the tables and the room, the pass is the pass and the kitchen stations. */
enum ServicePlace: string
{
    case Floor = 'floor';
    case Pass = 'pass';
}
