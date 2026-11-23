<?php

declare(strict_types=1);

namespace App\Domain\Event\Timeline\Model;

use App\Enum\MilestoneOwner;
use App\Enum\PermissionArea;
use DateTimeImmutable;

/** One dated entry on an event's timeline, read from the area it belongs to and never stored (sc-3624). */
final readonly class Milestone
{
    /**
     * @param string $key      the same on every read of its event, so a subscribed calendar keeps one entry per milestone (sc-3626)
     * @param bool   $done     a "You" milestone its area has seen through, so it is passed rather than overdue (sc-4022)
     * @param int    $revision added to the event's version for a subscribed calendar's SEQUENCE, by a source whose date moves without the event's row (sc-30812)
     */
    public function __construct(
        public string $key,
        public DateTimeImmutable $at,
        public string $title,
        public ?string $note,
        public MilestoneOwner $owner,
        public PermissionArea $area,
        public ?MilestoneAction $action = null,
        public bool $done = false,
        public int $revision = 0,
    ) {
    }
}
