<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** A payment provider's webhook event, kept by its id so a repeat is acknowledged and ignored (sc-3933). */
#[ORM\Entity]
#[ORM\Table(name: 'provider_events')]
class ProviderEvent
{
    public function __construct(
        #[ORM\Id]
        #[ORM\Column(type: Types::STRING, length: 64)]
        private string $eventId,
        #[ORM\Column(type: Types::STRING, length: 64)]
        private string $eventType,
        #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
        private DateTimeImmutable $occurredAt,
        #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
        private DateTimeImmutable $receivedAt,
    ) {
    }

    public function getEventId(): string
    {
        return $this->eventId;
    }

    public function getEventType(): string
    {
        return $this->eventType;
    }

    public function getOccurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }

    public function getReceivedAt(): DateTimeImmutable
    {
        return $this->receivedAt;
    }
}
