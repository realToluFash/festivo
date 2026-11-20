<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use DateTimeImmutable;

/** What a revision may change, checked: the amount in the event currency's minor unit and the day it was quoted. */
final readonly class QuoteTerms
{
    public function __construct(
        public int $amountMinor,
        public DateTimeImmutable $quotedOn,
    ) {
    }
}
