<?php

declare(strict_types=1);

namespace App\Enum;

/** Where QuantityResolver read a basis's quantity (sc-83), so a surface can say "163 accepted" rather than only "163". */
enum QuantitySource: string
{
    case Accepted = 'accepted';
    case SeatingTables = 'seating_tables';
    case StaffHours = 'staff_hours';
    case EventDays = 'event_days';
    case Fixed = 'fixed';
}
