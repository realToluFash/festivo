<?php

declare(strict_types=1);

namespace App\Domain\Menu\Http;

use App\Domain\Menu\Interfaces\MenuPicksInterface;
use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Repository\MenuCourseRepository;
use App\Repository\MenuDishRepository;
use Psl\Dict;
use Psl\Vec;

/** An event's menu as the clients read it (sc-3902): every course in order, each with its dishes. */
final readonly class MenuSerialiser
{
    public function __construct(
        private MenuCourseRepository $menuCourseRepository,
        private MenuDishRepository $menuDishRepository,
        private MenuPicksInterface $menuPicks,
    ) {
    }

    /** @return array{courses: list<array<string, mixed>>} */
    public function menu(Event $event): array
    {
        $dishes = Dict\group_by($this->menuDishRepository->findOnEvent($event), static fn (MenuDish $dish): string => $dish->getCourse()->getId()->toRfc4122());

        return [
            'courses' => Vec\map($this->menuCourseRepository->findOnEvent($event), fn (MenuCourse $course): array => [
                'id' => $course->getId()->toRfc4122(),
                'name' => $course->getName(),
                'servedAt' => $course->getServedAt(),
                'answer' => $course->guestsChoose() ? 'choose' : 'same',
                'skippable' => $course->isSkippable(),
                'dishes' => Vec\map($dishes[$course->getId()->toRfc4122()] ?? [], $this->dish(...)),
            ]),
        ];
    }

    /** @return array<string, mixed> `allergens` null is never stated, empty is none of the 14 */
    private function dish(MenuDish $dish): array
    {
        return [
            'id' => $dish->getId()->toRfc4122(),
            'name' => $dish->getName(),
            'description' => $dish->getDescription(),
            'allergens' => $dish->getAllergens(),
            'diets' => $dish->getDiets(),
            'libraryDishId' => $dish->getLibraryDish()?->getId()->toRfc4122(),
            'picked' => [] !== $this->menuPicks->pickersOf($dish),
        ];
    }
}
