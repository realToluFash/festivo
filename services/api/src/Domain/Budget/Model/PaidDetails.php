<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use DateTimeImmutable;

final readonly class PaidDetails
{
    public function __construct(
        public int $amountMinor,
        public DateTimeImmutable $paidOn,
        public ?string $reference,
    ) {
    }
}
