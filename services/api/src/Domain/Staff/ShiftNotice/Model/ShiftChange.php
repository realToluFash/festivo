<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice\Model;

use App\Enum\ShiftChangeKind;
use DateTimeImmutable;

/**
 * One line of a change notice. Shift lines carry wall-clock times; the job, date and venue lines their values; More changes how many shift lines were left out.
 */
final readonly class ShiftChange
{
    private function __construct(
        public ShiftChangeKind $kind,
        public ?DateTimeImmutable $start = null,
        public ?DateTimeImmutable $end = null,
        public ?DateTimeImmutable $oldStart = null,
        public ?DateTimeImmutable $oldEnd = null,
        public ?string $new = null,
        public ?string $old = null,
        public int $count = 0,
        public ?DateTimeImmutable $on = null,
        public bool $dated = false,
    ) {
    }

    /** A start or end time. A time on a day other than `on` names its day, and every time does when `on` is null; `dated` adds the date to each day named. */
    public static function time(ShiftChangeKind $kind, DateTimeImmutable $new, DateTimeImmutable $old, ?DateTimeImmutable $on, bool $dated): self
    {
        return new self($kind, start: $new, oldStart: $old, on: $on, dated: $dated);
    }

    public static function shift(ShiftChangeKind $kind, DateTimeImmutable $start, DateTimeImmutable $end, ?DateTimeImmutable $oldStart = null, ?DateTimeImmutable $oldEnd = null, bool $dated = false): self
    {
        return new self($kind, $start, $end, $oldStart, $oldEnd, dated: $dated);
    }

    public static function value(ShiftChangeKind $kind, ?string $new, ?string $old): self
    {
        return new self($kind, new: $new, old: $old);
    }

    public static function more(int $count): self
    {
        return new self(ShiftChangeKind::MoreChanges, count: $count);
    }

    public static function noShiftLeft(): self
    {
        return new self(ShiftChangeKind::NoShiftLeft);
    }
}
