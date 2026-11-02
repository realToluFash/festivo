<?php

declare(strict_types=1);

namespace App\Domain\Event\Timeline\Interfaces;

use App\Domain\Event\Timeline\Model\Milestone;
use App\Entity\Event;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/** How an area adds its dates to an event's timeline (docs/architecture/event-timeline.md). A class implementing this is read on every request; nothing else adds a milestone. */
#[AutoconfigureTag(self::TAG)]
interface MilestoneSourceInterface
{
    public const string TAG = 'app.milestone_source';

    /**
     * Titles and notes in the request's language. Every milestone names this source's area.
     *
     * @return list<Milestone>
     */
    public function milestones(Event $event): array;
}
