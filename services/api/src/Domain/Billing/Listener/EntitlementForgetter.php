<?php

declare(strict_types=1);

namespace App\Domain\Billing\Listener;

use App\Domain\Billing\Entitlements;
use App\Entity\Subscription;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsEntityListener;
use Doctrine\ORM\Events;

/** Whoever writes a subscription, a provider's adapter or staff, the cached answer goes with it. */
#[AsEntityListener(event: Events::postUpdate, method: 'forget', entity: Subscription::class)]
#[AsEntityListener(event: Events::postRemove, method: 'forget', entity: Subscription::class)]
final readonly class EntitlementForgetter
{
    public function __construct(
        private Entitlements $entitlements,
    ) {
    }

    public function forget(Subscription $subscription): void
    {
        $this->entitlements->forget($subscription->getOrganisation()->getId());
    }
}
