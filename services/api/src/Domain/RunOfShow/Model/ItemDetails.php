<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Model;

use DateTimeImmutable;

/** A schedule item as the rules accepted it: trimmed, with blanks as null. */
final readonly class ItemDetails
{
    public function __construct(
        public string $title,
        public DateTimeImmutable $startsAt,
        public ?int $lengthMinutes,
        public ?string $place,
        public ?string $ownerName,
        public ?string $ownerRole,
        public ?string $note,
        public bool $fixedTime,
        public bool $showToGuests,
    ) {
    }
}
