<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Entity\Event;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishVariant;
use App\Locale\NameNormaliser;
use App\Repository\MenuChoiceOptionRepository;
use App\Repository\MenuCourseRepository;
use App\Repository\MenuDishRepository;
use App\Repository\MenuDishVariantRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** A course's items (sc-34230): one name is one item, whichever dish or option it comes from, each once in the order it first appears, the dishes' then the course's own. */
final readonly class CourseItemLister
{
    public function __construct(
        private MenuCourseRepository $menuCourseRepository,
        private MenuDishRepository $menuDishRepository,
        private MenuDishVariantRepository $menuDishVariantRepository,
        private MenuChoiceOptionRepository $menuChoiceOptionRepository,
    ) {
    }

    /** @return list<array{course: MenuCourse, items: list<string>}> every course in the menu's order */
    public function onEvent(Event $event): array
    {
        $dishes = Dict\group_by($this->menuDishRepository->findOnEvent($event), static fn (MenuDish $dish): string => $dish->getCourse()->getId()->toRfc4122());
        $variants = Dict\group_by($this->menuDishVariantRepository->findOnEvent($event), static fn (MenuDishVariant $variant): string => $variant->getDish()->getId()->toRfc4122());
        $options = Dict\group_by($this->menuChoiceOptionRepository->findOnEvent($event), static fn (MenuChoiceOption $option): string => $option->getChoice()->getId()->toRfc4122());

        return Vec\map($this->menuCourseRepository->findOnEvent($event), static fn (MenuCourse $course): array => [
            'course' => $course,
            'items' => self::items($course, $dishes[$course->getId()->toRfc4122()] ?? [], $variants, $options),
        ]);
    }

    /**
     * @param list<MenuDish>                        $dishes   in the menu's order
     * @param array<string, list<MenuDishVariant>>  $variants by dish id
     * @param array<string, list<MenuChoiceOption>> $options  by choice id
     *
     * @return list<string>
     */
    public static function items(MenuCourse $course, array $dishes, array $variants, array $options): array
    {
        $names = [];

        foreach ($dishes as $dish) {
            $items = $dish->getItems();

            if ([] === $items) {
                $names[] = $dish->getName();

                continue;
            }

            foreach ($items as $item) {
                $names = [...$names, ...match ($item['kind']) {
                    'fixed' => [$item['name']],
                    'variants' => Vec\map($variants[$dish->getId()->toRfc4122()] ?? [], static fn (MenuDishVariant $one): string => $one->getName()),
                    'choice' => Vec\map($options[$item['choiceId']] ?? [], static fn (MenuChoiceOption $one): string => $one->getName()),
                }];
            }
        }

        $seen = [];
        $items = [];

        foreach ([...$names, ...$course->getOwnItems()] as $name) {
            $key = NameNormaliser::key($name);

            if (!Iter\contains($seen, $key)) {
                $seen[] = $key;
                $items[] = NameNormaliser::name($name);
            }
        }

        return $items;
    }
}
