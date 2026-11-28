<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestReplies\Model;

use App\Enum\GuestChangeKind;
use App\Enum\GuestReply;
use DateTimeImmutable;

/** One guest under Changed since you looked: what they did since the member last looked, a reply before anything else, and when they last did anything. */
final readonly class GuestChangeRow
{
    public function __construct(
        public string $guestId,
        public string $name,
        public GuestChangeKind $kind,
        public ?GuestReply $answer,
        public DateTimeImmutable $at,
    ) {
    }
}
