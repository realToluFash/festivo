<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use App\Enum\StaffPay;

/** In the event currency's minor unit: an hour's rate, or the fee for each person. */
final readonly class PayRate
{
    public function __construct(
        public StaffPay $pay,
        public int $minor,
    ) {
    }
}
