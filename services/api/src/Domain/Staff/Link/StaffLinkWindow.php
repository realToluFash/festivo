<?php

declare(strict_types=1);

namespace App\Domain\Staff\Link;

use DateTimeImmutable;

/**
 * Where now falls in a person's link window: `from` only before it opens, and not before a person with no shift has one; `until` until it has ended.
 *
 * `clockUntil` is past the window, while the person is still clocked in (sc-234): the link then opens their clock card alone, until then, and is ended for everything else.
 */
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
