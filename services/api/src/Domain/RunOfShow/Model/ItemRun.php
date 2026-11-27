<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Model;

use App\Entity\SchedulePress;
use DateTimeImmutable;

/** An item's state as its presses leave it, and the press that put it there, named when a later one loses to it. */
final readonly class ItemRun
{
    public function __construct(
        public ?DateTimeImmutable $startedAt = null,
        public ?DateTimeImmutable $endedAt = null,
        public bool $skipped = false,
        public ?SchedulePress $startedBy = null,
        public ?SchedulePress $finishedBy = null,
    ) {
    }

    public function isNow(): bool
    {
        return null !== $this->startedAt && null === $this->endedAt && !$this->skipped;
    }

    public function isOver(): bool
    {
        return null !== $this->endedAt || $this->skipped;
    }
}
