<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Domain\Event\Interfaces\EventAmountsInterface;
use App\Entity\Event;
use App\Repository\MenuDishRepository;
use App\Repository\MenuDishVariantRepository;

/** A variant's Cost and the cost a dish took from a fold (sc-3903), 0 included: each holds the event's currency. */
final readonly class MenuCosts implements EventAmountsInterface
{
    public function __construct(
        private MenuDishVariantRepository $variants,
        private MenuDishRepository $dishes,
    ) {
    }

    public function anyRecordedFor(Event $event): bool
    {
        return $this->variants->anyCostOnEvent($event) || $this->dishes->anyCostOnEvent($event);
    }
}
