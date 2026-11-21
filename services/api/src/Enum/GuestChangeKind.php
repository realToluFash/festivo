<?php

declare(strict_types=1);

namespace App\Enum;

/** What a guest did that their event's members hear of under Guest replies (sc-4331). A reply outranks the rest on the guest's one row. */
enum GuestChangeKind: string
{
    case Replied = 'replied';
    case Changed = 'changed';
    case Needs = 'needs';
    case Flagged = 'flagged';
    case Question = 'question';

    public function isReply(): bool
    {
        return self::Replied === $this || self::Changed === $this;
    }
}
