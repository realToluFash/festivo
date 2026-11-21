<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

/** A library dish as the Add dish and Edit forms send it, checked by DishRules. */
final readonly class DishDetails
{
    /**
     * @param list<string> $allergens in Annex II order; empty is "contains none of these"
     * @param list<string> $diets     in sc-3777's order
     */
    public function __construct(
        public string $name,
        public ?string $description,
        public array $allergens,
        public array $diets,
        public ?LastPrice $lastPrice,
    ) {
    }
}
