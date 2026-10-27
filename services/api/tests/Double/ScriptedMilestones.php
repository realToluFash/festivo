<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Domain\Event\Timeline\Interfaces\MilestoneSourceInterface;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Entity\Event;

/** Stands in for the areas whose milestones later epics add (sc-3624), so the timeline is seen merging more than the event's own dates. */
final class ScriptedMilestones implements MilestoneSourceInterface
{
    /** @var array<string, list<Milestone>> */
    private array $added = [];

    public function add(string $eventId, Milestone $milestone): void
    {
        $this->added[$eventId][] = $milestone;
    }

    public function milestones(Event $event): array
    {
        return $this->added[$event->getId()->toRfc4122()] ?? [];
    }
}
