<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use DateTimeImmutable;

final readonly class PaymentDetails
{
    public function __construct(
        public string $description,
        public int $amountMinor,
        public DateTimeImmutable $dueOn,
    ) {
    }
}
