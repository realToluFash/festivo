<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Domain\Event\Timeline\Interfaces\MilestoneSourceInterface;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Entity\Event;
use Closure;

/** Stands in for the areas whose milestones later epics add (sc-3624), so the timeline is seen merging more than the event's own dates. */
final class ScriptedMilestones implements MilestoneSourceInterface
{
    /** @var array<string, list<Closure(): Milestone>> */
    private array $added = [];

    public function add(string $eventId, Milestone $milestone): void
    {
        $this->addRead($eventId, static fn (): Milestone => $milestone);
    }

    /** @param Closure(): Milestone $read made on every read, as a real source makes its milestones */
    public function addRead(string $eventId, Closure $read): void
    {
        $this->added[$eventId][] = $read;
    }

    public function milestones(Event $event): array
    {
        $milestones = [];

        foreach ($this->added[$event->getId()->toRfc4122()] ?? [] as $read) {
            $milestones[] = $read();
        }

        return $milestones;
    }
}
