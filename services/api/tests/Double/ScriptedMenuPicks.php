<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Domain\Menu\Interfaces\MenuPicksInterface;
use App\Domain\Menu\Pick\StoredMenuPicks;
use App\Entity\Guest;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Entity\MenuDishVariant;

/** The picks guests stored (sc-3907), and on top of them whoever a test names as having picked a dish, a variant or an option of a choice, or answered None for me. */
final class ScriptedMenuPicks implements MenuPicksInterface
{
    public function __construct(
        private readonly StoredMenuPicks $stored,
    ) {
    }

    /** @var array<string, list<Guest>> */
    private array $pickers = [];

    /** @var array<string, int> */
    private array $none = [];

    public function pick(string $dishId, Guest $person): void
    {
        $this->pickers[$dishId][] = $person;
    }

    public function answerNone(string $choiceId): void
    {
        $this->none[$choiceId] = ($this->none[$choiceId] ?? 0) + 1;
    }

    public function pickersOf(MenuDish $dish): array
    {
        return [...$this->stored->pickersOf($dish), ...$this->pickers[$dish->getId()->toRfc4122()] ?? []];
    }

    public function pickersOfVariant(MenuDishVariant $variant): array
    {
        return [...$this->stored->pickersOfVariant($variant), ...$this->pickers[$variant->getId()->toRfc4122()] ?? []];
    }

    public function pickersOfOption(MenuChoiceOption $option): array
    {
        return [...$this->stored->pickersOfOption($option), ...$this->pickers[$option->getId()->toRfc4122()] ?? []];
    }

    public function noneAnswersTo(MenuDishChoice $choice): int
    {
        return $this->stored->noneAnswersTo($choice) + ($this->none[$choice->getId()->toRfc4122()] ?? 0);
    }
}
