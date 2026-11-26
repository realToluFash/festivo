<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use Symfony\Component\Uid\Uuid;

final readonly class GuestMessageSent
{
    public function __construct(
        public Uuid $id,
        public GuestMessagePlan $plan,
    ) {
    }
}
