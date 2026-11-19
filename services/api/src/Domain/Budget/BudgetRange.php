<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\LineCost;
use App\Domain\Budget\Model\QuantityFacts;
use App\Entity\BudgetLine;
use App\Enum\CostBasis;
use Psl\Iter;
use Psl\Math;
use Psl\Vec;

/** Two figures, never one (sc-84): only a per-head line differs between them, priced at `ifAllCome` for `potential`. */
final readonly class BudgetRange
{
    /** @param list<LineCost> $lines */
    public function __construct(
        public int $confirmedMinor,
        public int $potentialMinor,
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
            $price = $line->getPriceMinor() ?? 0;
            $potential = CostBasis::PerHead === $line->getBasis() ? $facts->ifAllCome : $quantity->count;

            return new LineCost($line, $quantity, $price * $quantity->count, $price * $potential);
        });

        return new self(
            Math\sum(Vec\map($costs, static fn (LineCost $cost): int => $cost->confirmedMinor)),
            Math\sum(Vec\map($costs, static fn (LineCost $cost): int => $cost->potentialMinor)),
            $facts->accepted,
            $facts->ifAllCome,
            Iter\count(Vec\filter($lines, static fn (BudgetLine $line): bool => 0 === $line->getPriceMinor())),
            $costs,
        );
    }

    public function confirmedPerHead(): ?int
    {
        return self::perHead($this->confirmedMinor, $this->confirmedHeads);
    }

    public function potentialPerHead(): ?int
    {
        return self::perHead($this->potentialMinor, $this->potentialHeads);
    }

    /** Half up to the minor unit; with nobody to divide by there is no figure, rather than a zero or an error. */
    private static function perHead(int $minor, int $heads): ?int
    {
        return 0 === $heads ? null : Math\div(2 * $minor + $heads, 2 * $heads);
    }
}
