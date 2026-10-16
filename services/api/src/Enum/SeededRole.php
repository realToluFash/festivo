<?php

declare(strict_types=1);

namespace App\Enum;

/** The roles every organisation is given at creation. sc-66 adds the four below Owner. */
enum SeededRole: string
{
    case Owner = 'owner';
}
