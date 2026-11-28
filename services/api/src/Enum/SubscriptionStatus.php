<?php

declare(strict_types=1);

namespace App\Enum;

enum SubscriptionStatus: string
{
    case Active = 'active';
    case PastDue = 'past_due';
    case ReadOnly = 'read_only';
    case Cancelled = 'cancelled';
}
