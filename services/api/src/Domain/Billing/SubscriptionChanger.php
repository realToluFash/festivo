<?php

declare(strict_types=1);

namespace App\Domain\Billing;

use App\Domain\Billing\Model\ChangedBy;
use App\Entity\Subscription;
use App\Entity\SubscriptionChange;
use App\Enum\Plan;
use App\Enum\SubscriptionChangeKind;
use App\Enum\SubscriptionSource;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/** Every write to a subscription, whatever the rail: each provider's adapter turns its events into these calls, so nothing branches on `source` (sc-3927). */
final readonly class SubscriptionChanger
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    public function changePlan(Subscription $subscription, Plan $plan, SubscriptionSource $source, ChangedBy $by): void
    {
        $subscription->setSource($source);

        if ($subscription->getPlan() === $plan) {
            return;
        }

        $this->record($subscription, SubscriptionChangeKind::Plan, $subscription->getPlan()->value, $plan->value, $by);
        $subscription->setPlan($plan);
    }

    private function record(Subscription $subscription, SubscriptionChangeKind $kind, ?string $from, ?string $to, ChangedBy $by): void
    {
        $this->entityManager->persist(new SubscriptionChange(
            $subscription,
            $kind,
            $from,
            $to,
            $by->actorType,
            $by->actorId,
            $by->actorLabel,
            $by->reason,
            $this->clock->now(),
        ));
    }
}
