<?php

declare(strict_types=1);

namespace App\Domain\Menu\Http;

use App\Domain\Menu\DishRules;
use App\Entity\Dish;
use DateTimeInterface;

/** A library dish as the clients read it (sc-3901). `lastPrice` is there only for a caller who holds budget.read. */
final class DishSerialiser
{
    /** @return array<string, mixed> `allergens` null is never stated, empty is none of the 14 */
    public static function dish(Dish $dish, bool $withPrice): array
    {
        $minor = $dish->getLastPriceMinor();
        $currency = $dish->getLastPriceCurrency();
        $price = $withPrice
            ? ['lastPrice' => null === $minor || null === $currency ? null : ['amount' => DishRules::written($minor, $currency), 'currency' => $currency]]
            : [];

        return [
            'id' => $dish->getId()->toRfc4122(),
            'name' => $dish->getName(),
            'description' => $dish->getDescription(),
            'allergens' => $dish->getAllergens(),
            'diets' => $dish->getDiets(),
            'usedByEvent' => $dish->isUsedByEvent(),
            'archivedAt' => $dish->getArchivedAt()?->format(DateTimeInterface::ATOM),
            ...$price,
        ];
    }
}
