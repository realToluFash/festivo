<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow;

use App\Domain\Menu\Interfaces\SchedulePublishedInterface;
use App\Domain\RunOfShow\Http\ScheduleSerialiser;
use App\Domain\RunOfShow\Screen\ScreenSignal;
use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;

/** Publishes an event's schedule whole to its topic, with a bare signal to its room screens to ask again (sc-3893, sc-3897). */
final readonly class SchedulePublisher implements SchedulePublishedInterface
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
        private ScheduleSerialiser $scheduleSerialiser,
        private ScreenSignal $screenSignal,
    ) {
    }

    public function published(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventSchedule, $event->getId()->toRfc4122(), $this->scheduleSerialiser->schedule($event));
        $this->screenSignal->send($event);
    }
}
