<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Domain\Menu\Interfaces\MenuPicksInterface;
use App\Entity\Guest;
use App\Entity\MenuDish;

/** Stands in for sc-3907's picks until guests can pick: a test names who picked a dish. */
final class ScriptedMenuPicks implements MenuPicksInterface
{
    /** @var array<string, list<Guest>> */
    private array $pickers = [];

    public function pick(string $dishId, Guest $person): void
    {
        $this->pickers[$dishId][] = $person;
    }

    public function pickersOf(MenuDish $dish): array
    {
        return $this->pickers[$dish->getId()->toRfc4122()] ?? [];
    }
}
