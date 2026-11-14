<?php

declare(strict_types=1);

namespace App\Domain\Event\Http;

use App\Domain\Event\Timeline\EventTimeline;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Entity\Event;
use App\Http\Access\Grants;
use DateTimeZone;
use Psl\Vec;

/** An event's timeline as both the timeline route and the events list serve it (sc-3624, sc-3594). */
final readonly class MilestoneSerialiser
{
    public function __construct(
        private EventTimeline $eventTimeline,
    ) {
    }

    /** @return list<array{at: string, title: string, note: ?string, owner: string, area: string, action: ?array{label: string, link: string}}> earliest first, at the offset in force in the event's zone */
    public function milestones(Event $event, Grants $grants): array
    {
        $zone = new DateTimeZone($event->getTimeZone());

        return Vec\map($this->eventTimeline->of($event, $grants), static fn (Milestone $milestone): array => [
            'at' => $milestone->at->setTimezone($zone)->format(\DATE_ATOM),
            'title' => $milestone->title,
            'note' => $milestone->note,
            'owner' => $milestone->owner->value,
            'area' => $milestone->area->value,
            'action' => null === $milestone->action ? null : ['label' => $milestone->action->label, 'link' => $milestone->action->link],
        ]);
    }
}
