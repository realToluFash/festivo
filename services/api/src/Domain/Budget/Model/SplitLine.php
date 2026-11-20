<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use App\Entity\Payer;
use App\Entity\PayerPart;
use App\Enum\PayerSplit;

/** A cost and who pays it (sc-91); flagged when its fixed amounts come to more than it now costs, which nothing re-spreads. */
final class SplitLine
{
    /** @var list<SplitPiece> */
    public array $pieces = [];

    /** @param list<PayerPart> $parts in the order the payers were added */
    public function __construct(
        public readonly LineCost $cost,
        public readonly ?PayerSplit $split,
        public readonly array $parts,
        public readonly ?Payer $rest,
        public readonly bool $flagged,
    ) {
    }

    public function isNotPriced(): bool
    {
        return 0 === $this->cost->line->getPriceMinor();
    }
}
