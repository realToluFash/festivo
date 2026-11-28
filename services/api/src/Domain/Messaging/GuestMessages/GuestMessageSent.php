<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use Symfony\Component\Uid\Uuid;

/** What Send answers: the message, and how many email deliveries it queued and how many can't be told. */
final readonly class GuestMessageSent
{
    public function __construct(
        public Uuid $id,
        public int $queued,
        public int $notSent,
    ) {
    }
}
