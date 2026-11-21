<?php

declare(strict_types=1);

namespace App\Domain\Billing;

use App\Domain\Billing\Catalogue\Catalogue;
use App\Entity\BillingAccount;
use App\Entity\CatalogueVersion;
use App\Entity\Organisation;
use App\Entity\Subscription;
use App\Enum\Plan;
use App\Enum\SubscriptionSource;
use App\Enum\SubscriptionStatus;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Psr\Clock\ClockInterface;

/** A new organisation's billing account and Free subscription on the catalogue version in force, flushed with the organisation itself (sc-3927, sc-3928). */
final readonly class SubscriptionStarter
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private Catalogue $catalogue,
    ) {
    }

    public function startFree(Organisation $organisation, string $billingContact): Subscription
    {
        $account = new BillingAccount($billingContact, $organisation->getCurrency(), $organisation->getCountryCode());
        $inForce = Type\instance_of(CatalogueVersion::class)->coerce($this->entityManager->getReference(CatalogueVersion::class, $this->catalogue->inForce()->versionId));
        $subscription = new Subscription($organisation, $account, Plan::Free, $inForce, SubscriptionStatus::Active, SubscriptionSource::Manual, $this->clock->now());

        $this->entityManager->persist($account);
        $this->entityManager->persist($subscription);

        return $subscription;
    }
}
