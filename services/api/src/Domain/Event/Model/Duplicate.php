<?php

declare(strict_types=1);

namespace App\Domain\Event\Model;

use App\Entity\Event;

/** A new Draft, and how many guests came with it: null when the guest list was not asked for (sc-3656). */
final readonly class Duplicate
{
    public function __construct(
        public Event $copy,
        public ?int $guestsCopied,
    ) {
    }
}
