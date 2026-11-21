<?php

declare(strict_types=1);

namespace App\Enum;

/** Which kind of address someone was reached or added by. */
enum ContactKind: string
{
    case Email = 'email';
    case Mobile = 'mobile';
}
