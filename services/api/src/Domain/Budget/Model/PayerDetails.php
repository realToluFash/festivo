<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

/** A payer's name and note as checked, trimmed, with a note of only spaces as none. */
final readonly class PayerDetails
{
    public function __construct(
        public string $name,
        public ?string $note,
    ) {
    }
}
