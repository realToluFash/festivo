<?php

declare(strict_types=1);

namespace App\Domain\Event\Timeline\Model;

use App\Enum\MilestoneOwner;
use App\Enum\PermissionArea;
use DateTimeImmutable;

/** One dated entry on an event's timeline, read from the area it belongs to and never stored (sc-3624). */
final readonly class Milestone
{
    public function __construct(
        public DateTimeImmutable $at,
        public string $title,
        public ?string $note,
        public MilestoneOwner $owner,
        public PermissionArea $area,
        public ?MilestoneAction $action = null,
    ) {
    }
}
