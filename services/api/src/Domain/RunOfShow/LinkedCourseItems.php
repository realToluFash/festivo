<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow;

use App\Domain\Event\LocalTimeResolver;
use App\Domain\Menu\Interfaces\CourseItemsInterface;
use App\Entity\Event;
use App\Repository\ScheduleItemRepository;
use DateTimeZone;
use Psr\Clock\ClockInterface;

/** Which schedule item each course of the menu is linked to (sc-3898). */
final readonly class LinkedCourseItems implements CourseItemsInterface
{
    public function __construct(
        private ScheduleItemRepository $scheduleItemRepository,
        private ClockInterface $clock,
    ) {
    }

    public function linkedTo(Event $event): array
    {
        $zone = new DateTimeZone($event->getTimeZone());
        $items = $this->scheduleItemRepository->findOnEvent($event);
        $expected = ExpectedStarts::of($items, $this->clock->now(), $zone);
        $linked = [];

        foreach ($items as $item) {
            $course = $item->getCourse();

            if (null === $course) {
                continue;
            }

            $linked[$course->getId()->toRfc4122()] = [
                'id' => $item->getId()->toRfc4122(),
                'title' => $item->getTitle(),
                'plannedAt' => LocalTimeResolver::resolve($item->getStartsAt(), $zone)->format(\DATE_ATOM),
                'expectedAt' => ($expected[$item->getId()->toRfc4122()] ?? null)?->setTimezone($zone)->format(\DATE_ATOM),
                'startedAt' => $item->getStartedAt()?->setTimezone($zone)->format(\DATE_ATOM),
                'endedAt' => $item->getEndedAt()?->setTimezone($zone)->format(\DATE_ATOM),
            ];
        }

        return $linked;
    }
}
