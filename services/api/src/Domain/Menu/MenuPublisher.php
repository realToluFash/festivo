<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Domain\Event\Interfaces\EventDatesMovedInterface;
use App\Domain\Menu\Http\MenuSerialiser;
use App\Domain\Menu\Interfaces\MenuPublishedInterface;
use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;

/** Publishes an event's menu whole to its topic: after each menu change, after an event change that moves when picks close (sc-3905), and after a schedule change that moves a linked course (sc-3898). */
final readonly class MenuPublisher implements EventDatesMovedInterface, MenuPublishedInterface
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
        private MenuSerialiser $menuSerialiser,
    ) {
    }

    public function published(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventMenu, $event->getId()->toRfc4122(), $this->menuSerialiser->menu($event));
    }

    public function datesMoved(Event $event): void
    {
        $this->published($event);
    }
}
