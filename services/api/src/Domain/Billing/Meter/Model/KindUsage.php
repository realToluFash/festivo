<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter\Model;

use App\Domain\Billing\Catalogue\Model\Allowance;

/** One kind's line of a period's reading. */
final readonly class KindUsage
{
    /** @param ?int<0, max> $left null when the plan includes an unlimited amount */
    public function __construct(
        public int $used,
        public Allowance $included,
        public ?int $left,
        public int $fromCredits,
    ) {
    }

    /** @return array{used: int, included: int|'unlimited', left: int|'unlimited', fromCredits: int} */
    public function written(): array
    {
        return [
            'used' => $this->used,
            'included' => $this->included->written(),
            'left' => $this->left ?? Allowance::UNLIMITED,
            'fromCredits' => $this->fromCredits,
        ];
    }
}
