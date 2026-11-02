<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

use App\Entity\Event;
use DateTimeImmutable;

final readonly class EventTimes
{
    public function __construct(
        public DateTimeImmutable $startsAt,
        public DateTimeImmutable $endsAt,
        public string $timeZone,
    ) {
    }

    public static function of(Event $event): self
    {
        return new self($event->getStartsAt(), $event->getEndsAt(), $event->getTimeZone());
    }
}
