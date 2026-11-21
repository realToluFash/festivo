<?php

declare(strict_types=1);

namespace App\Domain\Staff\Model;

use DateTimeImmutable;

/** A shift's times, wall-clock in the event's zone, and People needed, as StaffPlanRules checked them. */
final readonly class ShiftDetails
{
    public function __construct(
        public DateTimeImmutable $startsAt,
        public DateTimeImmutable $endsAt,
        public int $needed,
    ) {
    }
}
