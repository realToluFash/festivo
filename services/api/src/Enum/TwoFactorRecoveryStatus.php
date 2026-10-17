<?php

declare(strict_types=1);

namespace App\Enum;

/** A request to get back in without the second factor (sc-509), from its codes to its answer. */
enum TwoFactorRecoveryStatus: string
{
    case Proving = 'proving';
    case Waiting = 'waiting';
    case Approved = 'approved';
    case TurnedDown = 'turned_down';
    case Expired = 'expired';
    case Cancelled = 'cancelled';
    /** A newer request was started, so its codes went to another device. */
    case Replaced = 'replaced';

    public function isOpen(): bool
    {
        return self::Proving === $this || self::Waiting === $this;
    }
}
