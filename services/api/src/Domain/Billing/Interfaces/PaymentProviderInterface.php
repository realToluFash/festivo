<?php

declare(strict_types=1);

namespace App\Domain\Billing\Interfaces;

use App\Domain\Billing\Catalogue\Model\Price;
use App\Domain\Billing\Model\SubscriptionState;
use App\Entity\Subscription;
use App\Enum\BillingInterval;
use App\Enum\Plan;

/** The merchant of record behind the hosted checkout. Card details go to it and never to Soirely; what it sells is priced from the catalogue (sc-3933). */
interface PaymentProviderInterface
{
    /** @return string the reference the web opens the provider's hosted checkout with */
    public function checkout(Subscription $subscription, Plan $plan, Price $price, BillingInterval $interval): string;

    /** @return string the reference the web opens the provider's hosted page for a new payment method with */
    public function paymentMethodUpdate(Subscription $subscription): string;

    /** What the provider holds for the subscription now, or null when it holds nothing. */
    public function subscriptionState(Subscription $subscription): ?SubscriptionState;

    /** @return list<string> the events the provider gave up delivering after its last retry */
    public function undeliveredEvents(): array;
}
