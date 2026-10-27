<?php

declare(strict_types=1);

namespace App\Domain\Event\Timeline;

use App\Domain\Event\EventDayCount;
use App\Domain\Event\Timeline\Interfaces\MilestoneSourceInterface;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Entity\Event;
use App\Enum\MilestoneOwner;
use App\Enum\PermissionArea;
use DateTimeZone;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The event's own start, and its end when it runs over more than one day. */
final readonly class EventDates implements MilestoneSourceInterface
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    public function milestones(Event $event): array
    {
        $name = ['{name}' => $event->getName()];
        $milestones = [new Milestone($event->getStartsAt(), $this->translator->trans('timeline.event_starts', $name), null, MilestoneOwner::Event, PermissionArea::Events)];

        if (EventDayCount::of($event->getStartsAt(), $event->getEndsAt(), new DateTimeZone($event->getTimeZone())) > 1) {
            $milestones[] = new Milestone($event->getEndsAt(), $this->translator->trans('timeline.event_ends', $name), null, MilestoneOwner::Event, PermissionArea::Events);
        }

        return $milestones;
    }
}
