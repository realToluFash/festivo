<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\LineCost;
use App\Domain\Budget\Model\LineMove;
use App\Domain\Budget\Model\QuantityFacts;
use App\Domain\Budget\Model\WhatIfChanges;
use App\Entity\BudgetLine;
use App\Enum\CostBasis;
use Psl\Iter;

/** What changes would cost (sc-86), priced before and after as sc-84 prices the range; a moved line at 0 is unknown, never free. */
final readonly class BudgetWhatIf
{
    /** @param list<LineMove> $moves */
    public function __construct(
        public BudgetRange $now,
        public BudgetRange $then,
        public array $moves,
    ) {
    }

    /** @param list<BudgetLine> $lines */
    public static function of(array $lines, QuantityFacts $facts, WhatIfChanges $changes): self
    {
        $after = $changes->applyTo($facts);
        $now = BudgetRange::of($lines, $facts);
        $then = BudgetRange::of($lines, $after);
        $moves = [];

        foreach ($now->lines as $at => $before) {
            $later = $then->lines[$at];
            $countNow = self::potentialCount($before, $facts);
            $countThen = self::potentialCount($later, $after);

            if ($before->quantity->count === $later->quantity->count && $countNow === $countThen) {
                continue;
            }

            $price = $before->line->getPriceMinor();
            $moves[] = new LineMove($before, $later, $countNow, $countThen, null !== $price && $price > 0);
        }

        return new self($now, $then, $moves);
    }

    public function fullyKnown(): bool
    {
        return Iter\all($this->moves, static fn (LineMove $move): bool => $move->known);
    }

    public function confirmedDelta(): int
    {
        return $this->then->confirmedMinor - $this->now->confirmedMinor;
    }

    public function potentialDelta(): int
    {
        return $this->then->potentialMinor - $this->now->potentialMinor;
    }

    private static function potentialCount(LineCost $cost, QuantityFacts $facts): int
    {
        return CostBasis::PerHead === $cost->line->getBasis() ? $facts->ifAllCome : $cost->quantity->count;
    }
}
