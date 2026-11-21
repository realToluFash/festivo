<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\LineCost;
use App\Domain\Budget\Model\QuantityFacts;
use App\Entity\BudgetLine;
use App\Enum\CostBasis;
use BcMath\Number;
use Psl\Iter;
use Psl\Vec;

/** Two figures, never one (sc-84): only a per-head line differs between them, priced at `ifAllCome` for `potential`. The staff-time line is Staff rates' total at both (sc-101). */
final readonly class BudgetRange
{
    /** @param list<LineCost> $lines */
    public function __construct(
        public Number $confirmedMinor,
        public Number $potentialMinor,
        public int $confirmedHeads,
        public int $potentialHeads,
        public int $notPriced,
        public array $lines,
    ) {
    }

    /** @param list<BudgetLine> $lines */
    public static function of(array $lines, QuantityFacts $facts): self
    {
        $costs = Vec\map($lines, static function (BudgetLine $line) use ($facts): LineCost {
            $quantity = QuantityResolver::resolve($line->getBasis(), $facts);
            if (CostBasis::PerStaffHour === $line->getBasis()) {
                return new LineCost($line, $quantity, new Number($facts->staffCostMinor), new Number($facts->staffCostMinor));
            }

            $price = new Number($line->getPriceMinor() ?? 0);
            $potential = CostBasis::PerHead === $line->getBasis() ? $facts->ifAllCome : $quantity->count;

            return new LineCost($line, $quantity, $price->mul($quantity->count), $price->mul($potential));
        });

        return new self(
            self::sum(Vec\map($costs, static fn (LineCost $cost): Number => $cost->confirmedMinor)),
            self::sum(Vec\map($costs, static fn (LineCost $cost): Number => $cost->potentialMinor)),
            $facts->accepted,
            $facts->ifAllCome,
            Iter\count(Vec\filter($lines, static fn (BudgetLine $line): bool => $line->isNotPriced())),
            $costs,
        );
    }

    public function confirmedPerHead(): ?Number
    {
        return self::perHead($this->confirmedMinor, $this->confirmedHeads);
    }

    public function potentialPerHead(): ?Number
    {
        return self::perHead($this->potentialMinor, $this->potentialHeads);
    }

    /** Half up to the minor unit; with nobody to divide by there is no figure, rather than a zero or an error. */
    private static function perHead(Number $minor, int $heads): ?Number
    {
        return 0 === $heads ? null : $minor->mul(2)->add($heads)->div(2 * $heads, 0);
    }

    /** @param list<Number> $amounts */
    private static function sum(array $amounts): Number
    {
        return Iter\reduce($amounts, static fn (Number $total, Number $amount): Number => $total->add($amount), new Number(0));
    }
}
