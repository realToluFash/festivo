<?php

declare(strict_types=1);

namespace App\Domain\Event\Deletion;

use App\Entity\Event;
use App\Enum\EventPhase;
use App\Repository\GuestRepository;
use App\Repository\StaffMemberRepository;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** Once a guest is invited (sc-14445) or somebody's briefing went (sc-4333), an event is deleted only when it is Finished. A Draft is never refused: it can be neither called off nor ended. */
final readonly class DeleteRefusal
{
    public const string GUESTS_INVITED = 'guestsInvited';
    public const string STAFF_BRIEFED = 'staffBriefed';

    public function __construct(
        private GuestRepository $guestRepository,
        private StaffMemberRepository $staffMemberRepository,
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
        $briefed = $this->staffMemberRepository->eventsWithBriefed($open);

        $refusals = [];
        foreach ($events as $event) {
            $id = $event->getId()->toRfc4122();
            $refusals[$id] = match (true) {
                isset($invited[$id]) => self::GUESTS_INVITED,
                isset($briefed[$id]) => self::STAFF_BRIEFED,
                default => null,
            };
        }

        return $refusals;
    }
}
