<?php

declare(strict_types=1);

namespace App\Domain\Budget\Http;

use App\Domain\Budget\BudgetRange;
use App\Domain\Budget\Model\LineCost;
use App\Domain\Budget\Model\Quantity;
use App\Domain\Budget\Model\QuantityFacts;
use App\Domain\Budget\QuantityResolver;
use App\Entity\BudgetLine;
use App\Entity\Event;
use App\Enum\CostBasis;
use App\Locale\Money;
use App\Repository\BudgetLineRepository;
use Psl\Dict;
use Psl\Vec;

/**
 * @phpstan-type Line array{id: string, label: string, category: string, basis: string, rate: ?string, amount: ?string, currency: string, note: ?string, quantity: array{count: int, source: string, reason: ?string}, createdAt: string, updatedAt: string}
 * @phpstan-type CostedLine array{id: string, label: string, category: string, basis: string, rate: ?string, amount: ?string, currency: string, note: ?string, quantity: array{count: int, source: string, reason: ?string}, createdAt: string, updatedAt: string, cost: array{confirmed: string, potential: string}}
 * @phpstan-type PerHead array{amount: ?string, heads: int}
 * @phpstan-type Counted array{count: int, source: string, reason: ?string}
 * @phpstan-type Range array{currency: string, confirmed: string, potential: string, perHead: array{confirmed: PerHead, potential: PerHead}, notPriced: int, quantities: array<string, Counted>, lines: list<CostedLine>}
 */
final readonly class BudgetSerialiser
{
    public function __construct(
        private BudgetLineRepository $budgetLineRepository,
        private QuantityResolver $quantityResolver,
    ) {
    }

    /** @return array{currency: string, lines: list<Line>} */
    public function list(Event $event): array
    {
        $facts = $this->quantityResolver->factsFor($event);

        return [
            'currency' => $event->getCurrency(),
            'lines' => Vec\map($this->budgetLineRepository->findOnEvent($event), static fn (BudgetLine $line): array => self::line($line, $facts)),
        ];
    }

    /**
     * The range and cost per head (sc-84), worked out on every read because an RSVP moves them, with what each basis counts today so Add a cost asks for no number (sc-85).
     *
     * @return Range
     */
    public function range(Event $event): array
    {
        $currency = $event->getCurrency();
        $facts = $this->quantityResolver->factsFor($event);
        $range = BudgetRange::of($this->budgetLineRepository->findOnEvent($event), $facts);
        $money = static fn (?int $minor): ?string => null === $minor ? null : Money::written($minor, $currency);

        return [
            'currency' => $currency,
            'confirmed' => Money::written($range->confirmedMinor, $currency),
            'potential' => Money::written($range->potentialMinor, $currency),
            'perHead' => [
                'confirmed' => ['amount' => $money($range->confirmedPerHead()), 'heads' => $range->confirmedHeads],
                'potential' => ['amount' => $money($range->potentialPerHead()), 'heads' => $range->potentialHeads],
            ],
            'notPriced' => $range->notPriced,
            'quantities' => Dict\from_entries(Vec\map(CostBasis::cases(), static fn (CostBasis $basis): array => [$basis->value, self::counted(QuantityResolver::resolve($basis, $facts))])),
            'lines' => Vec\map($range->lines, static fn (LineCost $cost): array => [
                ...self::line($cost->line, $facts),
                'cost' => ['confirmed' => Money::written($cost->confirmedMinor, $currency), 'potential' => Money::written($cost->potentialMinor, $currency)],
            ]),
        ];
    }

    /** @return Line */
    public function one(BudgetLine $line): array
    {
        return self::line($line, $this->quantityResolver->factsFor($line->getEvent()));
    }

    /** @return Line */
    private static function line(BudgetLine $line, QuantityFacts $facts): array
    {
        $currency = $line->getEvent()->getCurrency();
        $price = $line->getPriceMinor();
        $written = null === $price ? null : Money::written($price, $currency);
        $quantity = self::counted(QuantityResolver::resolve($line->getBasis(), $facts));

        return [
            'id' => $line->getId()->toRfc4122(),
            'label' => $line->getLabel(),
            'category' => $line->getCategory()->value,
            'basis' => $line->getBasis()->value,
            'rate' => CostBasis::Fixed === $line->getBasis() ? null : $written,
            'amount' => CostBasis::Fixed === $line->getBasis() ? $written : null,
            'currency' => $currency,
            'note' => $line->getNote(),
            'quantity' => $quantity,
            'createdAt' => $line->getCreatedAt()->format(\DATE_ATOM),
            'updatedAt' => $line->getUpdatedAt()->format(\DATE_ATOM),
        ];
    }

    /** @return Counted */
    private static function counted(Quantity $quantity): array
    {
        return ['count' => $quantity->count, 'source' => $quantity->source->value, 'reason' => $quantity->reason];
    }
}
