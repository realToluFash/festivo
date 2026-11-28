<?php

declare(strict_types=1);

namespace App\Domain\Guest\Http;

use App\Domain\Event\EventVenue;
use App\Domain\Event\Http\EventSerialiser;
use App\Entity\Event;
use App\Enum\GuestPagePhase;

/** The event as the guest page shows it, to a guest by their link and to a host previewing that page. */
final readonly class GuestPageEvent
{
    public function __construct(
        private EventSerialiser $eventSerialiser,
    ) {
    }

    /** @return array<string, mixed> */
    public function of(Event $event, GuestPagePhase $phase): array
    {
        $venue = EventVenue::of($event);

        return [
            'id' => $event->getId()->toRfc4122(),
            'name' => $event->getName(),
            'type' => $event->getType()->value,
            'cover' => $this->eventSerialiser->coverOf($event),
            'hosts' => $event->getHosts(),
            // Its way in to Your messages names who reaches the guest (sc-3969).
            'organisation' => $event->getOrganisation()->getName(),
            // The hosts' own words, shown only once it is over and never translated (sc-6476).
            'thankYou' => GuestPagePhase::Finished === $phase ? $event->getThankYou() : null,
            'startsAt' => $event->getStartsAt()->format(\DATE_ATOM),
            'timeZone' => $event->getTimeZone(),
            'venue' => null === $venue ? null : ['name' => $venue->name, 'address' => $venue->address?->formatted],
            'arrivalNote' => $event->getArrivalNote(),
            'replyBy' => $event->getReplyBy()?->format('Y-m-d'),
        ];
    }
}
