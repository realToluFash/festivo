<?php

declare(strict_types=1);

namespace App\Domain\Billing\Model;

use App\Enum\Plan;
use App\Enum\SubscriptionSource;
use App\Enum\SubscriptionStatus;
use DateTimeImmutable;

/** What a provider says a subscription now is, in the shape every adapter normalises into (docs/architecture/billing.md, Payment rails). */
final readonly class SubscriptionState
{
    /**
     * @param ?DateTimeImmutable $periodEnd  null when the provider gives no period, as for a cancelled subscription: the end held stays
     * @param ?DateTimeImmutable $billedFrom set only when the provider bills from a new date, the one thing that moves the period start
     */
    public function __construct(
        public SubscriptionSource $source,
        public string $externalRef,
        public Plan $plan,
        public SubscriptionStatus $status,
        public ?DateTimeImmutable $periodEnd,
        public ?DateTimeImmutable $billedFrom = null,
    ) {
    }
}
