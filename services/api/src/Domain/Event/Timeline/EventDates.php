<?php

declare(strict_types=1);

namespace App\Domain\Event\Timeline;

use App\Domain\Event\EventDayCount;
use App\Domain\Event\Timeline\Interfaces\MilestoneSourceInterface;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Entity\Event;
use App\Enum\EventPhase;
use App\Enum\MilestoneOwner;
use App\Enum\PermissionArea;
use DateTimeImmutable;
use DateTimeZone;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The event's own dates as they happened: its start, its end when it runs over more than one day, or the moment it was called off (sc-16709). */
final readonly class EventDates implements MilestoneSourceInterface
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    public function milestones(Event $event): array
    {
        $zone = new DateTimeZone($event->getTimeZone());
        $endedAt = $event->getEndedAt()?->setTimezone($zone);

        if (null !== $endedAt && EventPhase::calledOff($endedAt, $event->getStartsAt())) {
            return [$this->milestone($event, 'called_off', $endedAt, 'timeline.event_called_off')];
        }

        $milestones = [$this->milestone($event, 'starts', $event->getStartsAt(), 'timeline.event_starts')];

        if (EventDayCount::of($event->getStartsAt(), $event->getEndsAt(), $zone) > 1) {
            $milestones[] = $this->milestone($event, 'ends', $endedAt ?? $event->getEndsAt(), 'timeline.event_ends');
        }

        return $milestones;
    }

    private function milestone(Event $event, string $key, DateTimeImmutable $at, string $title): Milestone
    {
        return new Milestone('event.' . $key, $at, $this->translator->trans($title, ['{name}' => $event->getName()]), null, MilestoneOwner::Event, PermissionArea::Events);
    }
}
