<?php

declare(strict_types=1);

namespace App\Enum;

/** The nine vendor categories (sc-82), in the order the budget lists them. */
enum CostCategory: string
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
}
