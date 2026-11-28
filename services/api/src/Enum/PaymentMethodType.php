<?php

declare(strict_types=1);

namespace App\Enum;

/** What the provider says pays: a card's details come with it, a wallet's never do, and anything else shows no line (sc-3933). */
enum PaymentMethodType: string
{
    case Card = 'card';
    case PayPal = 'paypal';
    case ApplePay = 'apple_pay';
    case GooglePay = 'google_pay';
    case Other = 'other';
}
