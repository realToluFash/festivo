<?php

declare(strict_types=1);

namespace App\Domain\Billing;

use App\Domain\Billing\Model\ChangedBy;
use App\Domain\Billing\Model\SubscriptionState;
use App\Entity\CatalogueVersion;
use App\Entity\Subscription;
use App\Entity\SubscriptionChange;
use App\Enum\Plan;
use App\Enum\SubscriptionChangeKind;
use App\Enum\SubscriptionSource;
use Closure;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/** Every write to a subscription, whatever the rail: each provider's adapter turns its events into these calls, so nothing branches on `source` (sc-3927). */
final readonly class SubscriptionChanger
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private Entitlements $entitlements,
    ) {
    }

    /** @param ?Closure(): void $alongside written in the same transaction, such as the audit of the change */
    public function changePlan(Subscription $subscription, Plan $plan, SubscriptionSource $source, ChangedBy $by, ?Closure $alongside = null): void
    {
        $this->entityManager->wrapInTransaction(function () use ($subscription, $plan, $source, $by, $alongside): void {
            if ($subscription->getPlan() !== $plan) {
                $this->record($subscription, SubscriptionChangeKind::Plan, $subscription->getPlan()->value, $plan->value, $by);
            }

            $subscription->changePlan($plan, $source);

            if (null !== $alongside) {
                $alongside();
            }
        });

        // After the commit: forgotten inside the transaction, a request in between re-caches the old plan.
        $this->entitlements->forget($subscription->getOrganisation()->getId());
    }

    /** @return bool false for a provider's word older than the one the subscription was last set from, which changes nothing (sc-3933) */
    public function apply(Subscription $subscription, SubscriptionState $state, ChangedBy $by): bool
    {
        $at = $by->at ?? $this->clock->now();
        $last = $subscription->getProviderUpdatedAt();

        if (null !== $last && $at < $last) {
            return false;
        }

        $this->entityManager->wrapInTransaction(function () use ($subscription, $state, $by, $at): void {
            if ($subscription->getPlan() !== $state->plan) {
                $this->record($subscription, SubscriptionChangeKind::Plan, $subscription->getPlan()->value, $state->plan->value, $by);
                $subscription->changePlan($state->plan, $state->source);
            }

            $endMoves = null !== $state->periodEnd && !self::same($subscription->getPeriodEnd(), $state->periodEnd);
            $startMoves = null !== $state->billedFrom && !self::same($subscription->getPeriodStart(), $state->billedFrom);

            if ($endMoves) {
                $this->record($subscription, SubscriptionChangeKind::PeriodEnd, $subscription->getPeriodEnd()?->format(DateTimeInterface::ATOM), $state->periodEnd->format(DateTimeInterface::ATOM), $by);
                $subscription->changePeriod($state->periodEnd);
            }

            if ($startMoves) {
                $this->record($subscription, SubscriptionChangeKind::PeriodStart, $subscription->getPeriodStart()->format(DateTimeInterface::ATOM), $state->billedFrom->format(DateTimeInterface::ATOM), $by);
                $subscription->startPeriodAt($state->billedFrom);
            }

            if ($subscription->getStatus() !== $state->status) {
                $this->record($subscription, SubscriptionChangeKind::Status, $subscription->getStatus()->value, $state->status->value, $by);
                $subscription->changeStatus($state->status);
            }

            $subscription->linkToProvider($state->source, $state->externalRef);
            $subscription->setProviderUpdatedAt($at);
        });

        $this->entitlements->forget($subscription->getOrganisation()->getId());

        return true;
    }

    /**
     * Moves each subscription onto the plan terms of `$version`, in one transaction (sc-3928).
     *
     * @param list<Subscription> $subscriptions
     * @param ?Closure(): void   $alongside     written in the same transaction, such as the audit of the move
     */
    public function moveToCatalogueVersion(array $subscriptions, CatalogueVersion $version, ChangedBy $by, ?Closure $alongside = null): void
    {
        $this->entityManager->wrapInTransaction(function () use ($subscriptions, $version, $by, $alongside): void {
            foreach ($subscriptions as $subscription) {
                if ($subscription->getCatalogueVersion() !== $version) {
                    $this->record($subscription, SubscriptionChangeKind::CatalogueVersion, $subscription->getCatalogueVersion()->getName(), $version->getName(), $by);
                    $subscription->setCatalogueVersion($version);
                }
            }

            if (null !== $alongside) {
                $alongside();
            }
        });

        foreach ($subscriptions as $subscription) {
            $this->entitlements->forget($subscription->getOrganisation()->getId());
        }
    }

    /**
     * Counts the subscription's periods from `$periodStart`, for a change the provider bills from a new date: an upgrade from Free, or a switch to yearly. A renewal never moves it (sc-3929, 24 Nov).
     *
     * @param ?Closure(): void $alongside written in the same transaction, such as the audit of the change
     */
    public function movePeriodStart(Subscription $subscription, DateTimeImmutable $periodStart, ChangedBy $by, ?Closure $alongside = null): void
    {
        $this->entityManager->wrapInTransaction(function () use ($subscription, $periodStart, $by, $alongside): void {
            $from = $subscription->getPeriodStart();

            if ($from->getTimestamp() !== $periodStart->getTimestamp()) {
                $this->record($subscription, SubscriptionChangeKind::PeriodStart, $from->format(DateTimeInterface::ATOM), $periodStart->format(DateTimeInterface::ATOM), $by);
                $subscription->startPeriodAt($periodStart);
            }

            if (null !== $alongside) {
                $alongside();
            }
        });

        $this->entitlements->forget($subscription->getOrganisation()->getId());
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
            $by->at ?? $this->clock->now(),
        ));
    }

    private static function same(?DateTimeImmutable $one, ?DateTimeImmutable $other): bool
    {
        return $one?->getTimestamp() === $other?->getTimestamp();
    }
}
