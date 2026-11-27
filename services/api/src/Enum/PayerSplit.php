<?php

declare(strict_types=1);

namespace App\Enum;

/** How a cost is split between its payers (sc-91): a part each holds a percentage in hundredths, or a fixed amount in the minor unit. */
enum PayerSplit: string
{
    case One = 'one';
    case Percent = 'percent';
    case Fixed = 'fixed';
}
