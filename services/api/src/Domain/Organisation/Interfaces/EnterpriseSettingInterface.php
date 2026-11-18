<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Interfaces;

use App\Entity\Organisation;
use App\Enum\PlanFeature;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/** A setting a plan unlocks, which says whether the organisation has configured it, so a downgrade can name what it switched off (sc-581). */
#[AutoconfigureTag(self::TAG)]
interface EnterpriseSettingInterface
{
    public const string TAG = 'app.enterprise_setting';

    public function feature(): PlanFeature;

    public function isConfigured(Organisation $organisation): bool;
}
