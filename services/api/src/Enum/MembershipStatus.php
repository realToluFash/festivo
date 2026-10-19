<?php

declare(strict_types=1);

namespace App\Enum;

/** docs/architecture/membership.md: every channel enters at active or pending_approval, and only active grants anything. */
enum MembershipStatus: string
{
    case PendingApproval = 'pending_approval';
    case Active = 'active';
    case Suspended = 'suspended';
    case LeftOrRemoved = 'left_or_removed';

    public function isEntry(): bool
    {
        return self::Active === $this || self::PendingApproval === $this;
    }

    /** The declared transitions, and no others: re-joining is the only way back from left_or_removed. */
    public function canBecome(self $to): bool
    {
        if ($to === $this) {
            return false;
        }

        return match ($to) {
            self::LeftOrRemoved => true,
            self::Active => self::PendingApproval === $this || self::Suspended === $this || self::LeftOrRemoved === $this,
            self::Suspended => self::Active === $this,
            self::PendingApproval => false,
        };
    }
}
