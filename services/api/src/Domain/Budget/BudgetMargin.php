<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\LineCharge;
use App\Domain\Budget\Model\LineCost;
use App\Domain\Budget\Model\MarginFigures;
use App\Entity\BudgetMarkup;
use App\Enum\ChargeSource;
use App\Enum\CostCategory;
use BcMath\Number;
use Psl\Iter;
use Psl\Vec;
use RoundingMode;

/** Client price = cost × (1 + markup), half away from zero per line (sc-92); a share is of summed totals, never an average of the lines'. */
final readonly class BudgetMargin
{
    private const int TENTHS_IN_WHOLE = 1000;

    /**
     * @param list<LineCharge>             $lines
     * @param array<string, MarginFigures> $categories by CostCategory value, only those with a line
     */
    public function __construct(
        public MarginFigures $total,
        public array $categories,
        public array $lines,
    ) {
    }

    /** @param list<BudgetMarkup> $markups */
    public static function of(BudgetRange $range, array $markups): self
    {
        $event = null;
        $byCategory = [];

        foreach ($markups as $markup) {
            $category = $markup->getCategory();

            if (null === $category) {
                $event = $markup->getMarkupTenths();
            } else {
                $byCategory[$category->value] = $markup->getMarkupTenths();
            }
        }

        $lines = Vec\map($range->lines, static fn (LineCost $cost): LineCharge => self::charge($cost, $byCategory[$cost->line->getCategory()->value] ?? null, $event));
        $categories = [];

        foreach (CostCategory::cases() as $category) {
            $in = Vec\filter($lines, static fn (LineCharge $line): bool => $line->cost->line->getCategory() === $category);

            if ([] !== $in) {
                $categories[$category->value] = self::sum($in);
            }
        }

        return new self(self::sum($lines), $categories, $lines);
    }

    private static function charge(LineCost $cost, ?int $category, ?int $event): LineCharge
    {
        $price = $cost->line->getClientPriceMinor();

        if (null !== $price) {
            return new LineCharge($cost, new MarginFigures(new Number($price), new Number($price), $cost->confirmedMinor, $cost->potentialMinor), ChargeSource::Price, null);
        }

        $own = $cost->line->getMarkupTenths();
        [$source, $tenths] = match (true) {
            null !== $own => [ChargeSource::Line, $own],
            null !== $category => [ChargeSource::Category, $category],
            null !== $event => [ChargeSource::Event, $event],
            default => [ChargeSource::None, 0],
        };

        return new LineCharge(
            $cost,
            new MarginFigures(self::markedUp($cost->confirmedMinor, $tenths), self::markedUp($cost->potentialMinor, $tenths), $cost->confirmedMinor, $cost->potentialMinor),
            $source,
            $tenths,
        );
    }

    private static function markedUp(Number $minor, int $tenths): Number
    {
        return $minor->mul(self::TENTHS_IN_WHOLE + $tenths)->div(self::TENTHS_IN_WHOLE, 3)->round(0, RoundingMode::HalfAwayFromZero);
    }

    /** @param list<LineCharge> $lines */
    private static function sum(array $lines): MarginFigures
    {
        return Iter\reduce($lines, static fn (MarginFigures $sum, LineCharge $line): MarginFigures => $sum->plus($line->figures), MarginFigures::none());
    }
}
