<?php

declare(strict_types=1);

namespace App\Enum;

/** Where a budget line's client price comes from (sc-92), the nearest first; `none` is no markup set anywhere, so the client is charged the cost. */
enum ChargeSource: string
{
    case Price = 'price';
    case Line = 'line';
    case Category = 'category';
    case Event = 'event';
    case None = 'none';
}
