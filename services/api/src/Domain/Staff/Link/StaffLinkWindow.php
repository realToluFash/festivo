<?php

declare(strict_types=1);

namespace App\Domain\Staff\Link;

use DateTimeImmutable;

/** Where now falls in a person's link window; `clockUntil`, past it, is while they are still clocked in and the link opens their clock card alone (sc-234). */
final readonly class StaffLinkWindow
{
    private function __construct(
        public bool $open,
        public bool $ended,
        public ?DateTimeImmutable $from,
        public ?DateTimeImmutable $until,
        public ?DateTimeImmutable $clockUntil = null,
    ) {
    }

    public static function notYet(DateTimeImmutable $from, DateTimeImmutable $until): self
    {
        return new self(false, false, $from, $until);
    }

    public static function noShiftYet(): self
    {
        return new self(false, false, null, null);
    }

    public static function open(DateTimeImmutable $until): self
    {
        return new self(true, false, null, $until);
    }

    public static function ended(?DateTimeImmutable $clockUntil = null): self
    {
        return new self(false, true, null, null, $clockUntil);
    }
}
