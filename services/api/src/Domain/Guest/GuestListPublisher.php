<?php

declare(strict_types=1);

namespace App\Domain\Guest;

use App\Domain\Guest\Headcount\HeadcountCalculator;
use App\Domain\Guest\Http\GuestSerialiser;
use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;

/** After any change to an event's list: the whole list without contacts (sc-1468), then its headcount (sc-99), to guests.read holders on that event alone. */
final readonly class GuestListPublisher
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
        private GuestSerialiser $guestSerialiser,
        private HeadcountCalculator $headcountCalculator,
    ) {
    }

    public function publish(Event $event): void
    {
        $id = $event->getId()->toRfc4122();
        $this->realtimePublisher->publish(RealtimeTopic::EventGuests, $id, $this->guestSerialiser->list($event, contacts: false));
        $this->realtimePublisher->publish(RealtimeTopic::EventHeadcount, $id, ['headcount' => $this->headcountCalculator->forEvent($event)]);
    }
}
