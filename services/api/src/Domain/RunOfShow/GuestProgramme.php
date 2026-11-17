<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow;

use App\Entity\Event;
use App\Entity\ScheduleItem;
use App\Enum\EventPhase;
use App\Enum\GuestPagePhase;
use App\Repository\ScheduleItemRepository;
use DateTimeZone;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** The day on the guest's page (sc-3899): only the items the hosts show to guests, and of each only its title, time and place, never its owner, note or lateness. */
final readonly class GuestProgramme
{
    public function __construct(
        private ScheduleItemRepository $scheduleItemRepository,
        private ClockInterface $clock,
    ) {
    }

    /**
     * Planned times, except while the event is Happening now (a Paused one keeps its planned times): then each item's start as the run view expects it, worked out over every item, shown or not, and rounded down to 5 minutes as the room screen (sc-3897) rounds it.
     *
     * @return list<array{title: string, startsAt: string, day: string, place: ?string}> by the time shown
     */
    public function of(Event $event, GuestPagePhase $phase): array
    {
        if (GuestPagePhase::CalledOff === $phase) {
            return [];
        }

        $zone = new DateTimeZone($event->getTimeZone());
        $now = $this->clock->now();
        $items = $this->scheduleItemRepository->findOnEvent($event);
        $happening = EventPhase::HappeningNow === EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now);
        $starts = $happening ? ExpectedStarts::of($items, $now, $zone) : [];
        $shown = Vec\map(
            Vec\filter($items, static fn (ScheduleItem $item): bool => $item->isShownToGuests()),
            static fn (ScheduleItem $item): array => [
                'title' => $item->getTitle(),
                'startsAt' => $happening
                    ? ExpectedStarts::roundedDown($starts[$item->getId()->toRfc4122()] ?? ExpectedStarts::planned($item, $zone), $zone)
                    : ExpectedStarts::planned($item, $zone),
                'day' => EventDay::of($item->getStartsAt()),
                'place' => $item->getPlace(),
            ],
        );

        return Vec\map(
            Vec\sort($shown, static fn (array $a, array $b): int => $a['startsAt'] <=> $b['startsAt']),
            static fn (array $item): array => [...$item, 'startsAt' => $item['startsAt']->format(\DATE_ATOM)],
        );
    }
}
