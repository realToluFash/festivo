<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

use App\Enum\EventStatus;
use DateTimeImmutable;

/** What the worker reads of an event when it sends, deleted rows included. */
final readonly class EventState
{
    public function __construct(
        public EventStatus $status,
        public DateTimeImmutable $startsAt,
        public DateTimeImmutable $endsAt,
        public ?DateTimeImmutable $endedAt,
        public bool $deleted,
    ) {
    }
}
