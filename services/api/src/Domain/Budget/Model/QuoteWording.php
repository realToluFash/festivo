<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

/** What a correction may change, checked: the budget lines are ids not yet resolved against the event. */
final readonly class QuoteWording
{
    /** @param list<string> $lineIds */
    public function __construct(
        public string $covers,
        public ?string $reference,
        public array $lineIds,
    ) {
    }
}
