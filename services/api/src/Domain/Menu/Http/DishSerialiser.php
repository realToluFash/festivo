<?php

declare(strict_types=1);

namespace App\Domain\Menu\Http;

use App\Entity\Dish;
use App\Entity\DishVariant;
use App\Locale\Money;
use DateTimeInterface;
use Psl\Vec;

/** A library dish as the clients read it (sc-3901), its variants inside it (sc-3903). `lastPrice` is there only for a caller who holds budget.read. */
final class DishSerialiser
{
    /**
     * @param list<DishVariant> $variants
     *
     * @return array<string, mixed> `allergens` null is never stated, empty is none of the 14
     */
    public static function dish(Dish $dish, bool $withPrice, array $variants): array
    {
        return [
            'id' => $dish->getId()->toRfc4122(),
            'name' => $dish->getName(),
            'description' => $dish->getDescription(),
            'allergens' => $dish->getAllergens(),
            'diets' => $dish->getDiets(),
            'usedByEvent' => $dish->isUsedByEvent(),
            'archivedAt' => $dish->getArchivedAt()?->format(DateTimeInterface::ATOM),
            'variants' => Vec\map($variants, static fn (DishVariant $variant): array => [
                'id' => $variant->getId()->toRfc4122(),
                'name' => $variant->getName(),
                'for' => $variant->isForChildren() ? 'children' : 'everyone',
                'allergens' => $variant->getAllergens(),
                'diets' => $variant->getDiets(),
                ...($withPrice ? ['lastPrice' => self::price($variant->getLastPriceMinor(), $variant->getLastPriceCurrency())] : []),
            ]),
            ...($withPrice ? ['lastPrice' => self::price($dish->getLastPriceMinor(), $dish->getLastPriceCurrency())] : []),
        ];
    }

    /** @return ?array{amount: string, currency: string} */
    private static function price(?int $minor, ?string $currency): ?array
    {
        return null === $minor || null === $currency ? null : ['amount' => Money::written($minor, $currency), 'currency' => $currency];
    }
}
