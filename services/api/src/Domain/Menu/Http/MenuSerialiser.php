<?php

declare(strict_types=1);

namespace App\Domain\Menu\Http;

use App\Domain\Menu\DishRules;
use App\Domain\Menu\Interfaces\MenuPicksInterface;
use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishVariant;
use App\Repository\MenuCourseRepository;
use App\Repository\MenuDishRepository;
use App\Repository\MenuDishVariantRepository;
use Psl\Dict;
use Psl\Vec;

/** An event's menu as the clients read it (sc-3902): every course in order, each with its dishes, and a dish's variants inside it (sc-3903). Costs only `$withPrice`, for a reader who holds budget.read. */
final readonly class MenuSerialiser
{
    public function __construct(
        private MenuCourseRepository $menuCourseRepository,
        private MenuDishRepository $menuDishRepository,
        private MenuDishVariantRepository $menuDishVariantRepository,
        private MenuPicksInterface $menuPicks,
    ) {
    }

    /** @return array{courses: list<array<string, mixed>>} */
    public function menu(Event $event, bool $withPrice = false): array
    {
        $dishes = Dict\group_by($this->menuDishRepository->findOnEvent($event), static fn (MenuDish $dish): string => $dish->getCourse()->getId()->toRfc4122());
        $variants = Dict\group_by($this->menuDishVariantRepository->findOnEvent($event), static fn (MenuDishVariant $variant): string => $variant->getDish()->getId()->toRfc4122());
        $currency = $event->getCurrency();

        return [
            'courses' => Vec\map($this->menuCourseRepository->findOnEvent($event), fn (MenuCourse $course): array => [
                'id' => $course->getId()->toRfc4122(),
                'name' => $course->getName(),
                'servedAt' => $course->getServedAt(),
                'answer' => $course->guestsChoose() ? 'choose' : 'same',
                'skippable' => $course->isSkippable(),
                'dishes' => Vec\map($dishes[$course->getId()->toRfc4122()] ?? [], fn (MenuDish $dish): array => $this->dish($dish, $variants[$dish->getId()->toRfc4122()] ?? [], $withPrice ? $currency : null)),
            ]),
        ];
    }

    /**
     * @param list<MenuDishVariant> $variants
     *
     * @return array<string, mixed> `allergens` null is never stated, empty is none of the 14
     */
    private function dish(MenuDish $dish, array $variants, ?string $currency): array
    {
        return [
            'id' => $dish->getId()->toRfc4122(),
            'name' => $dish->getName(),
            'description' => $dish->getDescription(),
            'allergens' => $dish->getAllergens(),
            'diets' => $dish->getDiets(),
            'libraryDishId' => $dish->getLibraryDish()?->getId()->toRfc4122(),
            'picked' => [] !== $this->menuPicks->pickersOf($dish),
            'variants' => Vec\map($variants, fn (MenuDishVariant $variant): array => $this->variant($variant, $currency)),
            ...(null === $currency ? [] : ['cost' => self::money($dish->getCostMinor(), $currency)]),
        ];
    }

    /** @return array<string, mixed> `pricedIn` names the library's currency when the copy's cost was left for the host to set */
    private function variant(MenuDishVariant $variant, ?string $currency): array
    {
        return [
            'id' => $variant->getId()->toRfc4122(),
            'name' => $variant->getName(),
            'for' => $variant->isForChildren() ? 'children' : 'everyone',
            'allergens' => $variant->getAllergens(),
            'diets' => $variant->getDiets(),
            'picked' => [] !== $this->menuPicks->pickersOfVariant($variant),
            ...(null === $currency ? [] : ['cost' => self::money($variant->getCostMinor(), $currency), 'pricedIn' => $variant->getPricedIn()]),
        ];
    }

    /** @return ?array{amount: string, currency: string} */
    private static function money(?int $minor, string $currency): ?array
    {
        return null === $minor ? null : ['amount' => DishRules::written($minor, $currency), 'currency' => $currency];
    }
}
