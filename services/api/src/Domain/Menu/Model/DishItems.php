<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

use App\Entity\MenuDish;

/**
 * A dish's items as Edit dish sends them, checked by ItemRules (sc-34230).
 *
 * @phpstan-import-type DishItem from MenuDish
 */
final readonly class DishItems
{
    /** @param list<DishItem> $items */
    public function __construct(
        public array $items,
    ) {
    }
}
