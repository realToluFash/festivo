<?php

declare(strict_types=1);

namespace App\Enum;

/** The nine a vendor is filed under (sc-82): a closed set, because reporting groups by it, so a tenth is a migration. */
enum VendorCategory: string
{
    case Catering = 'catering';
    case Venue = 'venue';
    case Flowers = 'flowers';
    case Photography = 'photography';
    case Music = 'music';
    case Transport = 'transport';
    case Staffing = 'staffing';
    case Hire = 'hire';
    case Other = 'other';

    /** In the order the form offers them. */
    public const array VALUES = ['catering', 'venue', 'flowers', 'photography', 'music', 'transport', 'staffing', 'hire', 'other'];
}
