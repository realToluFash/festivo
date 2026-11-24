<?php

declare(strict_types=1);

namespace App\Domain\Billing\Model;

use App\Enum\Actor;
use DateTimeImmutable;
use Symfony\Component\Uid\Uuid;

/** Who a subscription change is recorded against: a person, a member of staff, or a provider's event. */
final readonly class ChangedBy
{
    private function __construct(
        public Actor $actorType,
        public ?Uuid $actorId,
        public ?string $actorLabel,
        public ?string $reason,
        public ?DateTimeImmutable $at = null,
    ) {
    }

    public static function staff(string $name, string $reason): self
    {
        return new self(Actor::Agent, null, $name, $reason);
    }

    /** A provider's event: its id is who, and the provider's time for it is when. */
    public static function provider(string $eventId, DateTimeImmutable $at): self
    {
        return new self(Actor::System, null, $eventId, null, $at);
    }
}
