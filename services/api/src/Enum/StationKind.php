<?php

declare(strict_types=1);

namespace App\Enum;

/** A station is a place somebody works, the Pass among them, or a section of the seating plan's tables (sc-3910). */
enum StationKind: string
{
    case Pass = 'pass';
    case Place = 'place';
    case Section = 'section';
}
