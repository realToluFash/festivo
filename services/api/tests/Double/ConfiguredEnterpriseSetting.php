<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Domain\Organisation\Interfaces\EnterpriseSettingInterface;
use App\Entity\Organisation;
use App\Enum\PlanFeature;

/** An Enterprise setting with a value of its own, kept on the double, which a plan change must leave as it is. */
final class ConfiguredEnterpriseSetting implements EnterpriseSettingInterface
{
    public function __construct(
        private readonly PlanFeature $feature,
        public ?string $value = null,
    ) {
    }

    public function feature(): PlanFeature
    {
        return $this->feature;
    }

    public function isConfigured(Organisation $organisation): bool
    {
        return null !== $this->value;
    }

    /** What the organisation is held to: the value, only while its plan unlocks the setting. */
    public function inForce(Organisation $organisation): ?string
    {
        return $organisation->getPlan()->unlocks($this->feature) ? $this->value : null;
    }
}
