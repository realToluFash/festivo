<?php

declare(strict_types=1);

namespace App\Domain\Staff\Link;

use App\Entity\Event;
use App\Enum\EventRole;
use DateTimeImmutable;

/** An event the account reaches without being a member of its organisation: a grant from outside (sc-71) or a staff link (sc-4235), at its level until it ends. */
final readonly class OutsideEvent
{
    public function __construct(
        public Event $event,
        public EventRole $role,
        public ?string $jobLabel,
        public ?DateTimeImmutable $until,
    ) {
    }
}
