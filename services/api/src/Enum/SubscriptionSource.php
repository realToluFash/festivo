<?php

declare(strict_types=1);

namespace App\Enum;

/** The rail a subscription is paid through: stored beside it for support and the provider's adapter, never read by an entitlement (docs/architecture/billing.md). */
enum SubscriptionSource: string
{
    case Paddle = 'paddle';
    case Stripe = 'stripe';
    case Apple = 'apple';
    case Google = 'google';
    case Invoice = 'invoice';
    case Manual = 'manual';
}
