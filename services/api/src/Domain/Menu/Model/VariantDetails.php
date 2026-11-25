<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

/** One variant as the variant form sends it, checked by VariantRules. On an event the price is its Cost, in the event's currency; in the library, its Last price. */
final readonly class VariantDetails
{
    /**
     * @param list<string> $allergens in Annex II order; empty is "contains none of these"
     * @param list<string> $diets     in sc-3777's order
     */
    public function __construct(
        public string $name,
        public bool $forChildren,
        public array $allergens,
        public array $diets,
        public ?LastPrice $price,
    ) {
    }
}
