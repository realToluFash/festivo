<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

use App\Enum\EventChangeKind;
use DateTimeImmutable;

/** One row of `event_changes` as an item reads it. A null actor name is Soirely support. */
final readonly class EventChangeEntry
{
    /** @param array<string, array{0: mixed, 1: mixed}> $fields */
    public function __construct(
        public string $id,
        public ?string $actorId,
        public ?string $actorName,
        public EventChangeKind $kind,
        public array $fields,
        public bool $eventDay,
        public DateTimeImmutable $createdAt,
        public ?DateTimeImmutable $restorableUntil,
    ) {
    }

    /** Who an item names for it: a member by id, a deleted account by the name it kept, or support. */
    public function person(): string
    {
        return $this->actorId ?? (null === $this->actorName ? 'support' : 'name:' . $this->actorName);
    }
}
