<?php

declare(strict_types=1);

namespace App\Enum;

/** A subscription's plan (sc-581, sc-3927), until sc-3928's catalogue. */
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
