<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Screen;

use App\Domain\Event\Interfaces\EventEndedInterface;
use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;

/** End now sends the room screens the bare signal a press sends, so they thank the room within seconds (sc-62588). */
final readonly class ScreensHearTheEnd implements EventEndedInterface
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
    ) {
    }

    public function ended(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventScreens, $event->getId()->toRfc4122(), []);
    }
}
