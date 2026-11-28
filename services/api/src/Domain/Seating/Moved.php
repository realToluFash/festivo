<?php

declare(strict_types=1);

namespace App\Domain\Seating;

/** @phpstan-import-type Move from GuestSeater */
final readonly class Moved
{
    /** @param list<Move> $moves */
    public function __construct(
        public array $moves,
        public bool $apart,
    ) {
    }
}
