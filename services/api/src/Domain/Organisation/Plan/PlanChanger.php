<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Plan;

use App\Audit\Auditor;
use App\Domain\Organisation\Interfaces\EnterpriseSettingInterface;
use App\Entity\Organisation;
use App\Enum\Actor;
use App\Enum\Plan;
use App\Enum\PlanFeature;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use RuntimeException;
use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;

/** Nothing is cleared on a change: a setting is in force only while `Plan::unlocks()` says so (sc-581). */
final readonly class PlanChanger
{
    public const string CHANGED = 'organisation.plan_changed';
    public const string SUBJECT = 'Organisation';

    /** @param iterable<EnterpriseSettingInterface> $settings */
    public function __construct(
        private Auditor $auditor,
        private PlanDowngradeMailer $planDowngradeMailer,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        #[AutowireIterator(EnterpriseSettingInterface::TAG)]
        private iterable $settings,
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

        $switchedOff = $this->switchedOff($organisation, $was, $plan);

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

    /** @return list<PlanFeature> */
    private function switchedOff(Organisation $organisation, Plan $was, Plan $plan): array
    {
        $settings = Vec\filter(
            Vec\values($this->settings),
            static fn (EnterpriseSettingInterface $setting): bool => $was->unlocks($setting->feature()) && !$plan->unlocks($setting->feature()) && $setting->isConfigured($organisation),
        );

        return Vec\map($settings, static fn (EnterpriseSettingInterface $setting): PlanFeature => $setting->feature());
    }
}
