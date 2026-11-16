<?php

declare(strict_types=1);

namespace App\Domain\Menu\Interfaces;

use App\Entity\Guest;
use App\Entity\MenuDish;
use App\Entity\MenuDishVariant;

/** Who has picked a dish on an event's menu (sc-3907): what refuses a Remove or a Delete, and whom an allergen added to the dish is counted against, until sc-3913. */
interface MenuPicksInterface
{
    /** @return list<Guest> each person once, a companion as their own */
    public function pickersOf(MenuDish $dish): array;

    /** @return list<Guest> who picked this way of a dish with variants (sc-3903), each person once */
    public function pickersOfVariant(MenuDishVariant $variant): array;
}
