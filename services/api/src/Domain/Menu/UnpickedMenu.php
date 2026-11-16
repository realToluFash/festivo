<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Domain\Menu\Interfaces\MenuPicksInterface;
use App\Entity\MenuDish;
use App\Entity\MenuDishVariant;

/** Guests cannot pick from a menu until sc-3907 is built, so nobody has picked anything. */
final readonly class UnpickedMenu implements MenuPicksInterface
{
    public function pickersOf(MenuDish $dish): array
    {
        return [];
    }

    public function pickersOfVariant(MenuDishVariant $variant): array
    {
        return [];
    }
}
