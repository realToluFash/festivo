<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Interfaces;

use App\Entity\Organisation;
use App\Enum\PlanFeature;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/** A setting a plan unlocks, which says only whether the organisation has configured it: its rule is applied after asking `EnterpriseSettings::inForce()`, never this, so a downgrade switches it off (sc-581). */
#[AutoconfigureTag(self::TAG)]
interface EnterpriseSettingInterface
{
    public const string TAG = 'app.enterprise_setting';

    public function feature(): PlanFeature;

    public function isConfigured(Organisation $organisation): bool;
}
