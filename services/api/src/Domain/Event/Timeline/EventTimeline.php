<?php

declare(strict_types=1);

namespace App\Domain\Event\Timeline;

use App\Domain\Event\Timeline\Interfaces\MilestoneSourceInterface;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Entity\Event;
use App\Http\Access\Grants;
use Psl\Vec;
use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;

/** Every area's milestones for one event, merged and sorted when read, and only those of areas the reader may see. */
final readonly class EventTimeline
{
    /** @param iterable<MilestoneSourceInterface> $sources */
    public function __construct(
        #[AutowireIterator(MilestoneSourceInterface::TAG)]
        private iterable $sources,
    ) {
    }

    /** @return list<Milestone> earliest first; two at the same instant keep their sources' order */
    public function of(Event $event, Grants $grants): array
    {
        $milestones = [];

        foreach ($this->sources as $source) {
            foreach ($source->milestones($event) as $milestone) {
                if ($grants->holds($milestone->area->reading())) {
                    $milestones[] = $milestone;
                }
            }
        }

        return Vec\sort_by($milestones, static fn (Milestone $milestone): int => $milestone->at->getTimestamp());
    }
}
