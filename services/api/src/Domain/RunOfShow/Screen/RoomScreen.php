<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Screen;

use App\Domain\RunOfShow\EventDay;
use App\Domain\RunOfShow\ExpectedStarts;
use App\Entity\ScheduleItem;
use App\Entity\ScreenLink;
use App\Enum\EventPhase;
use App\Repository\ScheduleItemRepository;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/**
 * What a place's room screen shows (sc-3897): the item running there and the next three, of the items shown to guests, each a title and an expected start rounded down to 5 minutes. Never a planned time, a length, an owner, a note or lateness, and Now carries no time at all.
 */
final readonly class RoomScreen
{
    public const int COMING_UP = 3;

    public function __construct(
        private ScheduleItemRepository $scheduleItemRepository,
        private ClockInterface $clock,
    ) {
    }

    /** @return array<string, mixed> */
    public function of(ScreenLink $link): array
    {
        $now = $this->clock->now();
        $event = $link->getEvent();
        $zone = new DateTimeZone($event->getTimeZone());
        $heard = ['at' => $now->setTimezone($zone)->format(\DATE_ATOM)];

        if (null !== $link->getReplacedAt()) {
            return ['kind' => 'replaced'] + $heard;
        }

        $named = ['eventId' => $event->getId()->toRfc4122(), 'event' => $event->getName(), 'locale' => $event->getOrganisation()->getLocale()] + $heard;
        $phase = EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now);

        if (EventPhase::Finished === $phase) {
            return EventPhase::calledOff($event->getEndedAt(), $event->getStartsAt())
                ? ['kind' => 'nothingLeft'] + $named
                : ['kind' => 'finished'] + $named;
        }

        $items = $this->scheduleItemRepository->findOnEvent($event);
        $starts = EventPhase::HappeningNow === $phase ? ExpectedStarts::of($items, $now, $zone) : [];
        $today = EventDay::of(new DateTimeImmutable($now->setTimezone($zone)->format('Y-m-d H:i'), new DateTimeZone('UTC')));
        $here = Vec\filter($items, static fn (ScheduleItem $item): bool => $item->isShownToGuests() && ($item->getPlace() ?? '') === $link->getPlace() && !$item->isSkipped());
        $running = Vec\filter($here, static fn (ScheduleItem $item): bool => null !== $item->getStartedAt() && null === $item->getEndedAt());
        $expected = static fn (ScheduleItem $item): DateTimeImmutable => ExpectedStarts::roundedDown($starts[$item->getId()->toRfc4122()] ?? ExpectedStarts::planned($item, $zone), $zone);
        $coming = Vec\sort(
            Vec\filter($here, static fn (ScheduleItem $item): bool => null === $item->getStartedAt() && null === $item->getEndedAt() && EventDay::of($item->getStartsAt()) >= $today),
            static fn (ScheduleItem $a, ScheduleItem $b): int => [$expected($a), $a->getStartsAt()] <=> [$expected($b), $b->getStartsAt()],
        );
        $on = $running[0] ?? null;

        if (null === $on && [] === $coming) {
            return ['kind' => 'nothingLeft'] + $named;
        }

        return ['kind' => 'live'] + $named + [
            'now' => null === $on ? null : ['id' => $on->getId()->toRfc4122(), 'title' => $on->getTitle()],
            'coming' => Vec\map(
                Vec\take($coming, self::COMING_UP),
                static fn (ScheduleItem $item): array => [
                    'id' => $item->getId()->toRfc4122(),
                    'title' => $item->getTitle(),
                    'startsAt' => $expected($item)->format(\DATE_ATOM),
                ],
            ),
        ];
    }
}
