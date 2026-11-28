<?php

declare(strict_types=1);

namespace App\Domain\Budget\Http;

use App\Domain\Budget\BudgetMargin;
use App\Domain\Budget\BudgetRange;
use App\Domain\Budget\MarginRules;
use App\Domain\Budget\Model\LineCharge;
use App\Domain\Budget\Model\MarginFigures;
use App\Domain\Budget\QuantityResolver;
use App\Entity\BudgetMarkup;
use App\Entity\Event;
use App\Enum\CostCategory;
use App\Locale\Money;
use App\Repository\BudgetLineRepository;
use App\Repository\BudgetMarkupRepository;
use BcMath\Number;
use Psl\Dict;
use Psl\Vec;

/**
 * The only writer of a client price or a margin (sc-92): build nothing shared or printed (sc-94) from it.
 *
 * @phpstan-type Pair array{confirmed: string, potential: string}
 * @phpstan-type Shares array{confirmed: ?string, potential: ?string}
 * @phpstan-type Figures array{client: Pair, cost: Pair, margin: Pair, share: Shares}
 * @phpstan-type ChargedLine array{id: string, label: string, category: string, basis: string, source: string, markup: ?string, price: ?string, client: Pair, cost: Pair, margin: Pair, share: Shares}
 * @phpstan-type Margin array{currency: string, markups: array{event: ?string, categories: array<string, string>}, total: Figures, categories: array<string, Figures>, lines: list<ChargedLine>}
 */
final readonly class MarginSerialiser
{
    public function __construct(
        private BudgetLineRepository $budgetLineRepository,
        private BudgetMarkupRepository $budgetMarkupRepository,
        private QuantityResolver $quantityResolver,
    ) {
    }

    /** @return Margin */
    public function margin(Event $event): array
    {
        $currency = $event->getCurrency();
        $markups = $this->budgetMarkupRepository->findOnEvent($event);
        $range = BudgetRange::of($this->budgetLineRepository->findOnEvent($event), $this->quantityResolver->factsFor($event));
        $margin = BudgetMargin::of($range, $markups);
        $tenths = Dict\from_entries(Vec\map($markups, static fn (BudgetMarkup $markup): array => [$markup->getCategory()->value ?? '', $markup->getMarkupTenths()]));
        $categories = [];

        foreach (CostCategory::cases() as $category) {
            if (isset($tenths[$category->value])) {
                $categories[$category->value] = MarginRules::written($tenths[$category->value]);
            }
        }

        return [
            'currency' => $currency,
            'markups' => [
                'event' => isset($tenths['']) ? MarginRules::written($tenths['']) : null,
                'categories' => $categories,
            ],
            'total' => self::figures($margin->total, $currency),
            'categories' => Dict\map($margin->categories, static fn (MarginFigures $figures): array => self::figures($figures, $currency)),
            'lines' => Vec\map($margin->lines, static function (LineCharge $charge) use ($currency): array {
                $line = $charge->cost->line;
                $price = $line->getClientPriceMinor();

                return [
                    'id' => $line->getId()->toRfc4122(),
                    'label' => $line->getLabel(),
                    'category' => $line->getCategory()->value,
                    'basis' => $line->getBasis()->value,
                    'source' => $charge->source->value,
                    'markup' => null === $charge->markupTenths ? null : MarginRules::written($charge->markupTenths),
                    'price' => null === $price ? null : Money::written($price, $currency),
                    ...self::figures($charge->figures, $currency),
                ];
            }),
        ];
    }

    /** @return Figures */
    private static function figures(MarginFigures $figures, string $currency): array
    {
        return [
            'client' => ['confirmed' => Money::written($figures->clientConfirmedMinor, $currency), 'potential' => Money::written($figures->clientPotentialMinor, $currency)],
            'cost' => ['confirmed' => Money::written($figures->costConfirmedMinor, $currency), 'potential' => Money::written($figures->costPotentialMinor, $currency)],
            'margin' => ['confirmed' => Money::written($figures->marginConfirmedMinor(), $currency), 'potential' => Money::written($figures->marginPotentialMinor(), $currency)],
            'share' => ['confirmed' => self::share($figures->shareConfirmedTenths()), 'potential' => self::share($figures->sharePotentialTenths())],
        ];
    }

    /** "20.0", "-11.1": a percent to one decimal, or null with no client price to divide by. */
    private static function share(?Number $tenths): ?string
    {
        return null === $tenths ? null : (string) $tenths->div(10, 1);
    }
}
