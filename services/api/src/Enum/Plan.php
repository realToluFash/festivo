<?php

declare(strict_types=1);

namespace App\Enum;

/** An organisation's plan (sc-581). Soirely staff set it until billing exists; sc-3927 makes it a subscription's. */
enum Plan: string
{
    case Free = 'free';
    case Enterprise = 'enterprise';

    /** The one list of what each plan unlocks: a feature asks here, never tests the plan by name (sc-581, until sc-3928's catalogue holds it). */
    public function unlocks(PlanFeature $feature): bool
    {
        return match ($feature) {
            PlanFeature::EmailDomains, PlanFeature::AuditLog, PlanFeature::GuestDataDeletion => self::Enterprise === $this,
        };
    }
}
