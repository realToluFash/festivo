<?php

declare(strict_types=1);

namespace App\Domain\Seating\Numbers;

use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;

/** Whenever a number changes (sc-103): the whole read, as a fresh read returns it, on the event's seating topic. A nudge, never the source of truth. */
final readonly class SeatingNumbersPublisher
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
        private SeatingNumbers $seatingNumbers,
    ) {
    }

    public function publish(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventSeating, $event->getId()->toRfc4122(), $this->seatingNumbers->of($event));
    }
}
