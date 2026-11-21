<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

use App\Enum\DeliveryNotSentReason;
use Symfony\Component\Uid\Uuid;

/** One email delivery decided when a message goes: queued to the address, or recorded Not sent with why (sc-3942). */
final readonly class PlannedDelivery
{
    public function __construct(
        public Uuid $recipientId,
        public string $name,
        public ?string $address,
        public ?DeliveryNotSentReason $notSent,
    ) {
    }

    public function isQueued(): bool
    {
        return null === $this->notSent;
    }
}
