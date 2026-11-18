<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Plan;

use App\Domain\Billing\Entitlements;
use App\Domain\Organisation\Interfaces\EnterpriseSettingInterface;
use App\Entity\Organisation;
use App\Enum\Plan;
use App\Enum\PlanFeature;
use Psl\Iter;
use Psl\Vec;
use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;

/** Where a setting's rule is asked whether it applies: only while the organisation's entitlement unlocks it, so a downgrade switches it off and keeps it (sc-581). */
final readonly class EnterpriseSettings
{
    /** @param iterable<EnterpriseSettingInterface> $settings */
    public function __construct(
        #[AutowireIterator(EnterpriseSettingInterface::TAG)]
        private iterable $settings,
        private Entitlements $entitlements,
    ) {
    }

    public function inForce(Organisation $organisation, PlanFeature $feature): bool
    {
        return $this->entitlements->of($organisation->getId())->unlocks($feature)
            && Iter\any($this->settings, static fn (EnterpriseSettingInterface $setting): bool => $feature === $setting->feature() && $setting->isConfigured($organisation));
    }

    /** @return list<PlanFeature> the configured settings `$was` unlocks and `$plan` does not */
    public function switchedOff(Organisation $organisation, Plan $was, Plan $plan): array
    {
        $settings = Vec\filter(
            Vec\values($this->settings),
            static fn (EnterpriseSettingInterface $setting): bool => $was->unlocks($setting->feature()) && !$plan->unlocks($setting->feature()) && $setting->isConfigured($organisation),
        );

        return Vec\map($settings, static fn (EnterpriseSettingInterface $setting): PlanFeature => $setting->feature());
    }
}
