<?php

declare(strict_types=1);

namespace App\Enum;

enum SubscriptionChangeKind: string
{
    case Plan = 'plan';
    case PeriodEnd = 'period_end';
    case PeriodStart = 'period_start';
    case Status = 'status';
    case CatalogueVersion = 'catalogue_version';
}
