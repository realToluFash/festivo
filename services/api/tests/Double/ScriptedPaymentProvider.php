<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Domain\Billing\Catalogue\Model\Price;
use App\Domain\Billing\Interfaces\PaymentProviderInterface;
use App\Domain\Billing\Model\SubscriptionState;
use App\Entity\Subscription;
use App\Enum\BillingInterval;
use App\Enum\Plan;
use LogicException;

/** The provider as a test says it is: what it holds for every subscription, and what it gave up delivering. */
final class ScriptedPaymentProvider implements PaymentProviderInterface
{
    /** @param list<string> $undelivered */
    public function __construct(
        public ?SubscriptionState $held = null,
        public array $undelivered = [],
    ) {
    }

    public function checkout(Subscription $subscription, Plan $plan, Price $price, BillingInterval $interval): string
    {
        throw new LogicException('Nothing here opens a checkout.');
    }

    public function paymentMethodUpdate(Subscription $subscription): string
    {
        throw new LogicException('Nothing here opens a payment method page.');
    }

    public function subscriptionState(Subscription $subscription): ?SubscriptionState
    {
        return $this->held;
    }

    public function undeliveredEvents(): array
    {
        return $this->undelivered;
    }
}
