<?php

declare(strict_types=1);

namespace App\Http\Access;

use App\Entity\Membership;
use Symfony\Component\Uid\Uuid;

/** Which of an organisation's events one member reaches, and with what, read once for a list (sc-29912). */
final readonly class EventScope
{
    /**
     * @param Membership|null       $onlyFor a Member, who reaches only the events in `$byEvent`; null for an Owner or Admin, who reach every one with their organisation's grants
     * @param array<string, Grants> $byEvent
     */
    public function __construct(
        public ?Membership $onlyFor,
        public Grants $organisation,
        private array $byEvent = [],
    ) {
    }

    public function on(Uuid $eventId): ?Grants
    {
        return null === $this->onlyFor ? $this->organisation : $this->byEvent[$eventId->toRfc4122()] ?? null;
    }
}
