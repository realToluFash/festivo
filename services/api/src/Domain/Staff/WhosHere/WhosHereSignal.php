<?php

declare(strict_types=1);

namespace App\Domain\Staff\WhosHere;

use App\Domain\Event\Interfaces\EventEndedInterface;
use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;

/** Who's here's signal to read again (sc-3918), after a clock-in or out, a correction, any change to the roster or its stations, and the event's end, so an open Who's here hears its 409. It carries nothing. */
final readonly class WhosHereSignal implements EventEndedInterface
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
    ) {
    }

    public function publish(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventWhosHere, $event->getId()->toRfc4122(), []);
    }

    public function ended(Event $event): void
    {
        $this->publish($event);
    }
}
