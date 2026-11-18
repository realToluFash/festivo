<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Plan;

use App\Audit\Auditor;
use App\Domain\Billing\Model\ChangedBy;
use App\Domain\Billing\SubscriptionChanger;
use App\Entity\Organisation;
use App\Enum\Actor;
use App\Enum\Plan;
use App\Enum\PlanFeature;
use App\Enum\SubscriptionSource;
use App\Repository\SubscriptionRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psr\Clock\ClockInterface;
use RuntimeException;

/** Staff moving an organisation's subscription to another plan by hand: the `manual` rail (sc-581, sc-3927). Nothing is cleared on a change: a setting is in force only while `EnterpriseSettings::inForce()` says so. */
final readonly class PlanChanger
{
    public const string CHANGED = 'organisation.plan_changed';
    public const string SUBJECT = 'Organisation';

    public function __construct(
        private Auditor $auditor,
        private PlanDowngradeMailer $planDowngradeMailer,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private EnterpriseSettings $enterpriseSettings,
        private SubscriptionRepository $subscriptionRepository,
        private SubscriptionChanger $subscriptionChanger,
    ) {
    }

    /** @return list<PlanFeature> the configured settings the change switched off, of which the administrators are told */
    public function change(Organisation $organisation, Plan $plan, string $agent, string $reason): array
    {
        $agent = Str\trim($agent);
        $reason = Str\trim($reason);

        if ('' === $agent) {
            throw new RuntimeException('Name the member of staff changing the plan.');
        }

        if ('' === $reason) {
            throw new RuntimeException('Give the reason for changing the plan.');
        }

        $subscription = $this->subscriptionRepository->findCurrentOf($organisation->getId());
        $was = $subscription->getPlan();

        if ($was === $plan) {
            return [];
        }

        $switchedOff = $this->enterpriseSettings->switchedOff($organisation, $was, $plan);

        $this->entityManager->wrapInTransaction(function () use ($organisation, $subscription, $was, $plan, $agent, $reason, $switchedOff): void {
            $this->subscriptionChanger->changePlan($subscription, $plan, SubscriptionSource::Manual, ChangedBy::staff($agent, $reason));
            $this->auditor->record(self::CHANGED, self::SUBJECT, $organisation->getId(), Actor::Agent, null, $agent, [
                'plan' => [$was->value, $plan->value],
                'reason' => [null, $reason],
            ]);

            if ([] !== $switchedOff) {
                $this->planDowngradeMailer->send($organisation, $switchedOff, $this->clock->now());
            }
        });

        return $switchedOff;
    }
}
