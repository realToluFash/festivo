<?php

declare(strict_types=1);

namespace App\Domain\Billing;

use App\Entity\BillingAccount;
use App\Entity\Organisation;
use App\Entity\Subscription;
use App\Enum\Plan;
use App\Enum\SubscriptionSource;
use App\Enum\SubscriptionStatus;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/** A new organisation's billing account and Free subscription, flushed with the organisation itself (sc-3927). */
final readonly class SubscriptionStarter
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    public function startFree(Organisation $organisation, string $billingContact): Subscription
    {
        $account = new BillingAccount($billingContact, $organisation->getCurrency(), $organisation->getCountryCode());
        $subscription = new Subscription($organisation, $account, Plan::Free, SubscriptionStatus::Active, SubscriptionSource::Manual, $this->clock->now());

        $this->entityManager->persist($account);
        $this->entityManager->persist($subscription);

        return $subscription;
    }
}
