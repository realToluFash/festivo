<?php

declare(strict_types=1);

namespace App\Enum;

/** How a claim to own an organisation with no active Owner ended (sc-6640). */
enum OwnerClaimOutcome: string
{
    case Passed = 'passed';
    case Stopped = 'stopped';
    case Unfound = 'unfound';
    case RecordRemoved = 'record_removed';
    case OwnerBack = 'owner_back';
    case ClaimantGone = 'claimant_gone';

    /** A stop is an objection, and a disputed ownership needs a person: nobody can claim again. */
    public function closesTheWay(): bool
    {
        return self::Stopped === $this;
    }

    /** Ran out on its own, which the claimant is told when they come back to the banner. */
    public function lapsed(): bool
    {
        return self::Unfound === $this || self::RecordRemoved === $this;
    }
}
