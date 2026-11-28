<?php

declare(strict_types=1);

namespace App\Enum;

enum BillingInterval: string
{
    case Month = 'month';
    case Year = 'year';
}
