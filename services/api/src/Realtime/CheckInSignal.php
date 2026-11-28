<?php

declare(strict_types=1);

namespace App\Realtime;

use App\Entity\Event;
use App\Enum\RealtimeTopic;

/** A bare signal that tells every open door of the event its list changed (sc-1454): an arrival, or a seat (sc-60684). It carries no name and no seat, so the door reads the list again through the API, which refuses an ended grant (sc-28230). */
final readonly class CheckInSignal
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
    ) {
    }

    public function send(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventCheckIn, $event->getId()->toRfc4122(), []);
    }
}
