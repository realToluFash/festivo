<?php

declare(strict_types=1);

namespace App\Enum;

/** A row of the roles screen's grid (sc-66), in the order it draws them. */
enum PermissionArea: string
{
    case Events = 'events';
    case Guests = 'guests';
    case Seating = 'seating';
    case Menu = 'menu';
    case RunOfShow = 'run_of_show';
    case Staff = 'staff';
    case Messages = 'messages';
    case Reports = 'reports';
    case Budget = 'budget';
    case Vendors = 'vendors';
    case Members = 'members';
    case Billing = 'billing';
    case Organisation = 'organisation';
}
