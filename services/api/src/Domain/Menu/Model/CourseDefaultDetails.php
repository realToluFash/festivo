<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

use App\Entity\MenuDish;
use App\Entity\MenuDishVariant;
use DateTimeImmutable;

/** A course's default and choose-by date as DefaultRules accepted them (sc-1362): a whole pick a guest could make, and a day before the event. */
final readonly class CourseDefaultDetails
{
    /** @param list<string> $options each required choice's, in the dish's order */
    public function __construct(
        public MenuDish $dish,
        public ?MenuDishVariant $variant,
        public array $options,
        public DateTimeImmutable $chooseBy,
    ) {
    }

    /** @return list<string> the diets the default meets: its variant's Suitable for, or the dish's when it has no variants */
    public function suitableFor(): array
    {
        return null === $this->variant ? $this->dish->getDiets() : $this->variant->getDiets();
    }
}
