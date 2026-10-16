<?php

declare(strict_types=1);

namespace App\Enum;

/** docs/architecture/membership.md: every channel enters at active or pending_approval. */
enum MembershipStatus: string
{
    case PendingApproval = 'pending_approval';
    case Active = 'active';
    case Suspended = 'suspended';
    case Left = 'left';
    case Removed = 'removed';
}
