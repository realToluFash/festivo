<?php

declare(strict_types=1);

namespace App\Domain\Budget\Http;

use App\Domain\Budget\Model\QuantityFacts;
use App\Domain\Budget\QuantityResolver;
use App\Domain\Menu\DishRules;
use App\Entity\BudgetLine;
use App\Entity\Event;
use App\Enum\CostBasis;
use App\Repository\BudgetLineRepository;
use Psl\Vec;

/**
 * @phpstan-type Line array{id: string, label: string, category: string, basis: string, rate: ?string, amount: ?string, currency: string, note: ?string, quantity: array{count: int, source: string, reason: ?string}, createdAt: string, updatedAt: string}
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
        $written = null === $price ? null : DishRules::written($price, $currency);
        $quantity = QuantityResolver::resolve($line->getBasis(), $facts);

        return [
            'id' => $line->getId()->toRfc4122(),
            'label' => $line->getLabel(),
            'category' => $line->getCategory()->value,
            'basis' => $line->getBasis()->value,
            'rate' => CostBasis::Fixed === $line->getBasis() ? null : $written,
            'amount' => CostBasis::Fixed === $line->getBasis() ? $written : null,
            'currency' => $currency,
            'note' => $line->getNote(),
            'quantity' => ['count' => $quantity->count, 'source' => $quantity->source->value, 'reason' => $quantity->reason],
            'createdAt' => $line->getCreatedAt()->format(\DATE_ATOM),
            'updatedAt' => $line->getUpdatedAt()->format(\DATE_ATOM),
        ];
    }
}
