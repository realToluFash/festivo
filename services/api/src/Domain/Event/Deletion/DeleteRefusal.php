<?php

declare(strict_types=1);

namespace App\Domain\Event\Deletion;

use App\Entity\Event;
use App\Enum\EventPhase;
use App\Repository\GuestRepository;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** Once a guest is invited, an event is deleted only when it is Finished (sc-14445). A Draft is never refused: it can be neither called off nor ended. */
final readonly class DeleteRefusal
{
    public const string GUESTS_INVITED = 'guestsInvited';

    public function __construct(
        private GuestRepository $guestRepository,
        private ClockInterface $clock,
    ) {
    }

    /** Why deleting it now would be refused 409 `event_call_off_first`, or null when it would not. */
    public function of(Event $event): ?string
    {
        return $this->forEvents([$event])[$event->getId()->toRfc4122()];
    }

    /**
     * @param list<Event> $events
     *
     * @return array<string, ?string> keyed by the event's id
     */
    public function forEvents(array $events): array
    {
        $now = $this->clock->now();
        $open = Vec\filter($events, static fn (Event $event): bool => match (EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now)) {
            EventPhase::Live, EventPhase::HappeningNow, EventPhase::Paused => true,
            EventPhase::Draft, EventPhase::Finished => false,
        });
        $invited = $this->guestRepository->eventsWithInvited($open);

        $refusals = [];
        foreach ($events as $event) {
            $id = $event->getId()->toRfc4122();
            $refusals[$id] = isset($invited[$id]) ? self::GUESTS_INVITED : null;
        }

        return $refusals;
    }
}
