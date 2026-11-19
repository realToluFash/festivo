<?php

declare(strict_types=1);

namespace App\Enum;

enum SubscriptionChangeKind: string
{
    case Plan = 'plan';
    case Period = 'period';
    case Status = 'status';
    case CatalogueVersion = 'catalogue_version';
}
