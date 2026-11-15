<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

use App\Entity\User;
use App\Enum\GuestReplyHow;

/** A host's Record a reply (sc-3787): who recorded it, how the guest told them, and whether they confirmed replacing the guest's own answer. */
final readonly class RecordedReply
{
    public function __construct(
        public User $by,
        public GuestReplyHow $how,
        public bool $replace,
    ) {
    }
}
