<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Screen;

use App\Domain\Event\Interfaces\EventEndedInterface;
use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;

/** A bare signal with no event data that tells the room screens to ask again; a refusing hub never fails the action (sc-62588). */
final readonly class ScreenSignal implements EventEndedInterface
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
    ) {
    }

    public function send(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventScreens, $event->getId()->toRfc4122(), []);
    }

    public function ended(Event $event): void
    {
        $this->send($event);
    }
}
