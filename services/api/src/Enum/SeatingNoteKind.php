<?php

declare(strict_types=1);

namespace App\Enum;

/** What a host knows about two guests (sc-1364): that they sit at one table, or that they do not. */
enum SeatingNoteKind: string
{
    case Together = 'together';
    case Apart = 'apart';
}
