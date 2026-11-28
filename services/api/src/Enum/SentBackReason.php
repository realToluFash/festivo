<?php

declare(strict_types=1);

namespace App\Enum;

/** The one reason a plate is sent back with (sc-4005). Allergy concern also alerts the floor. */
enum SentBackReason: string
{
    case WrongDish = 'wrongDish';
    case NotRight = 'notRight';
    case Dropped = 'dropped';
    case AllergyConcern = 'allergyConcern';
}
