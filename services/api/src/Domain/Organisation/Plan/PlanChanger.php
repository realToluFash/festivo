<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Plan;

use App\Audit\Auditor;
use App\Entity\Organisation;
use App\Enum\Actor;
use App\Enum\Plan;
use App\Enum\PlanFeature;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psr\Clock\ClockInterface;
use RuntimeException;

/** Nothing is cleared on a change: a setting is in force only while `EnterpriseSettings::inForce()` says so (sc-581). */
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
    ) {
    }

    /** @return list<PlanFeature> the configured settings the change switched off, of which the administrators are told */
    public function change(Organisation $organisation, Plan $plan, string $agent): array
    {
        $agent = Str\trim($agent);

        if ('' === $agent) {
            throw new RuntimeException('Name the member of staff changing the plan.');
        }

        $was = $organisation->getPlan();

        if ($was === $plan) {
            return [];
        }

        $switchedOff = $this->enterpriseSettings->switchedOff($organisation, $was, $plan);

        $this->entityManager->wrapInTransaction(function () use ($organisation, $was, $plan, $agent, $switchedOff): void {
            $organisation->setPlan($plan);
            $this->auditor->record(self::CHANGED, self::SUBJECT, $organisation->getId(), Actor::Agent, null, $agent, [
                'plan' => [$was->value, $plan->value],
            ]);

            if ([] !== $switchedOff) {
                $this->planDowngradeMailer->send($organisation, $switchedOff, $this->clock->now());
            }
        });

        return $switchedOff;
    }
}
