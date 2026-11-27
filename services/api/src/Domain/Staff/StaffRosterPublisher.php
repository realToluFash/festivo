<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Domain\Staff\Http\StaffSerialiser;
use App\Domain\Staff\WhosHere\WhosHereSignal;
use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;

/** After any change to an event's roster, the whole roster to staff.read holders on that event alone (sc-3906), and Who's here's signal (sc-3918). */
final readonly class StaffRosterPublisher
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
        private StaffSerialiser $staffSerialiser,
        private WhosHereSignal $whosHereSignal,
    ) {
    }

    public function publish(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventStaff, $event->getId()->toRfc4122(), $this->staffSerialiser->list($event));
        $this->whosHereSignal->publish($event);
    }
}
