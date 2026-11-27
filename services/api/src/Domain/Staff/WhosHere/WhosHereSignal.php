<?php

declare(strict_types=1);

namespace App\Domain\Staff\WhosHere;

use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;

/** Who's here's signal to read again (sc-3918), after a clock-in or out, a correction, or any change to the roster or its stations. It carries nothing. */
final readonly class WhosHereSignal
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
    ) {
    }

    public function publish(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventWhosHere, $event->getId()->toRfc4122(), []);
    }
}
