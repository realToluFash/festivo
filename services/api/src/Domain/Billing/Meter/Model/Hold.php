<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter\Model;

use App\Enum\UsageKind;
use Symfony\Component\Uid\Uuid;

/** What a reservation set aside, and the price it fixed: a catalogue change after it reprices nothing it holds. */
final readonly class Hold
{
    /** @param int<1, max> $quantity */
    public function __construct(
        public Uuid $reservationId,
        public UsageKind $kind,
        public int $quantity,
        public int $includedUnits,
        public int $creditUnits,
        public Uuid $unitCostVersionId,
        public int $creditsPerUnit,
    ) {
    }

    public function credits(): int
    {
        return $this->creditUnits * $this->creditsPerUnit;
    }
}
