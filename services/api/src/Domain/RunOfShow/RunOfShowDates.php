<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow;

use App\Domain\Event\LocalTimeResolver;
use App\Domain\Event\Timeline\Interfaces\MilestoneSourceInterface;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Entity\Event;
use App\Entity\ScheduleItem;
use App\Enum\MilestoneOwner;
use App\Enum\PermissionArea;
use App\Repository\ScheduleItemRepository;
use DateTimeZone;
use Psl\Iter;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Each event day's first item, "Run of show begins", and every fixed-time item, owner Event (sc-3893, Decided 19 Oct). Not every item: the full list is the Schedule page. */
final readonly class RunOfShowDates implements MilestoneSourceInterface
{
    public const string KEY_PREFIX = 'run_of_show.';

    public function __construct(
        private ScheduleItemRepository $scheduleItemRepository,
        private TranslatorInterface $translator,
    ) {
    }

    public function milestones(Event $event): array
    {
        $zone = new DateTimeZone($event->getTimeZone());
        $milestones = [];
        $daysBegun = [];

        foreach ($this->scheduleItemRepository->findOnEvent($event) as $item) {
            $day = EventDay::of($item->getStartsAt());

            if (!Iter\contains($daysBegun, $day)) {
                $daysBegun[] = $day;
                $milestones[] = $this->milestone(self::KEY_PREFIX . 'begins.' . $day, $item, $zone, $this->translator->trans('timeline.run_of_show_begins'));
            }

            if ($item->isFixedTime()) {
                $milestones[] = $this->milestone(self::KEY_PREFIX . 'item.' . $item->getId()->toRfc4122(), $item, $zone, $item->getTitle());
            }
        }

        return $milestones;
    }

    private function milestone(string $key, ScheduleItem $item, DateTimeZone $zone, string $title): Milestone
    {
        return new Milestone($key, LocalTimeResolver::resolve($item->getStartsAt(), $zone), $title, null, MilestoneOwner::Event, PermissionArea::RunOfShow);
    }
}
