<?php

declare(strict_types=1);

namespace App\Enum;

/** An item's state at its station for a course, one for every plate that has it (sc-4005). Never an order's. */
enum ItemState: string
{
    case Ready = 'ready';
    case Preparing = 'preparing';

    /** @return list<int> the minutes "Ready in about" may say */
    public static function readyIn(): array
    {
        return [5, 10, 15];
    }
}
