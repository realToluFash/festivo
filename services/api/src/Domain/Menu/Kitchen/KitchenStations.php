<?php

declare(strict_types=1);

namespace App\Domain\Menu\Kitchen;

use App\Domain\Menu\Interfaces\ServingStationsInterface;
use App\Domain\Menu\Pick\PicksMenu;
use App\Entity\Event;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishVariant;
use App\Locale\NameNormaliser;
use App\Repository\MenuChoiceOptionRepository;
use App\Repository\MenuDishRepository;
use App\Repository\MenuDishVariantRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/**
 * @phpstan-import-type Course from PicksMenu
 * @phpstan-import-type Spot from PicksMenu
 * @phpstan-import-type SheetStation from KitchenSheet
 */
final readonly class KitchenStations
{
    public function __construct(
        private ServingStationsInterface $servingStations,
        private MenuDishRepository $menuDishRepository,
        private MenuDishVariantRepository $menuDishVariantRepository,
        private MenuChoiceOptionRepository $menuChoiceOptionRepository,
    ) {
    }

    /**
     * @param list<Course>                       $courses
     * @param array<string, array<string, Spot>> $spots   by course, then person
     *
     * @return array<string, ?list<SheetStation>> by course; null on a course that uses neither items nor stations, where every dish is its own item at the Pass
     */
    public function of(Event $event, array $courses, array $spots): array
    {
        $dishes = Dict\from_entries(Vec\map($this->menuDishRepository->findOnEvent($event), static fn (MenuDish $dish): array => [$dish->getId()->toRfc4122(), $dish]));
        $variants = Dict\from_entries(Vec\map($this->menuDishVariantRepository->findOnEvent($event), static fn (MenuDishVariant $one): array => [$one->getId()->toRfc4122(), $one]));
        $options = Dict\group_by($this->menuChoiceOptionRepository->findOnEvent($event), static fn (MenuChoiceOption $one): string => $one->getChoice()->getId()->toRfc4122());
        ['stops' => $stops, 'courses' => $served] = $this->servingStations->of($event);
        $listed = Dict\from_entries(Vec\map($served, static fn (array $one): array => [$one['course']->getId()->toRfc4122(), $one]));
        $pass = $stops[0]['id'];
        $by = [];

        foreach ($courses as $course) {
            $one = $listed[$course['id']] ?? null;

            if (null === $one) {
                $by[$course['id']] = null;

                continue;
            }

            $items = $one['items'];
            $uses = [] !== $one['course']->getOwnItems()
                || Iter\any($dishes, static fn (MenuDish $dish): bool => $dish->getCourse() === $one['course'] && [] !== $dish->getItems())
                || Iter\any($items, static fn (array $item): bool => $pass !== $item['stop']);
            $by[$course['id']] = $uses
                ? self::stations($one['course'], $items, $stops, Vec\values($spots[$course['id']] ?? []), $dishes, $variants, $options)
                : null;
        }

        return $by;
    }

    /**
     * @param list<array{name: string, key: string, stop: string}> $items
     * @param non-empty-list<array{id: string, name: string}>      $stops    the Pass first
     * @param list<Spot>                                           $spots
     * @param array<string, MenuDish>                              $dishes
     * @param array<string, MenuDishVariant>                       $variants
     * @param array<string, list<MenuChoiceOption>>                $options  by choice id
     *
     * @return list<SheetStation>
     */
    private static function stations(MenuCourse $course, array $items, array $stops, array $spots, array $dishes, array $variants, array $options): array
    {
        /** @param Spot $spot */
        $plate = static function (array $spot) use ($course, $dishes, $variants, $options): ?array {
            if ('skipped' === $spot['state']) {
                return null;
            }

            $own = Vec\map($course->getOwnItems(), NameNormaliser::key(...));
            $dish = $dishes[$spot['dish'] ?? ''] ?? null;

            if (null === $dish || $dish->getCourse() !== $course || !Iter\contains(['dish', 'defaulted'], $spot['state'])) {
                return ['chefs' => true, 'keys' => $own];
            }

            if ([] === $dish->getItems()) {
                return ['chefs' => false, 'keys' => [NameNormaliser::key($dish->getName()), ...$own]];
            }

            $chefs = false;
            $names = [];

            foreach ($dish->getItems() as $item) {
                if ('fixed' === $item['kind']) {
                    $names[] = $item['name'];
                } elseif ('variants' === $item['kind']) {
                    $variant = $variants[$spot['variant'] ?? ''] ?? null;
                    $names = null !== $variant && $variant->getDish() === $dish ? [...$names, $variant->getName()] : $names;
                } else {
                    $picked = Vec\filter($options[$item['choiceId']] ?? [], static fn (MenuChoiceOption $one): bool => Iter\contains($spot['options'] ?? [], $one->getId()->toRfc4122()));
                    $chefs = $chefs || ([] === $picked && 'defaulted' === $spot['state']);
                    $names = [...$names, ...Vec\map($picked, static fn (MenuChoiceOption $one): string => $one->getName())];
                }
            }

            return ['chefs' => $chefs, 'keys' => [...Vec\map($names, NameNormaliser::key(...)), ...$own]];
        };
        $plates = Vec\filter_nulls(Vec\map($spots, $plate));
        $chefs = Iter\count(Vec\filter($plates, static fn (array $plate): bool => $plate['chefs']));
        $countOf = static fn (string $key): int => Iter\count(Vec\filter($plates, static fn (array $plate): bool => Iter\contains($plate['keys'], $key)));
        $stations = [];

        foreach ($stops as $at => $stop) {
            $lines = Vec\map(
                Vec\filter($items, static fn (array $item): bool => $item['stop'] === $stop['id']),
                static fn (array $item): array => ['name' => $item['name'], 'count' => $countOf($item['key']), 'chefs' => false],
            );

            if (0 === $at && $chefs > 0) {
                $lines[] = ['name' => '', 'count' => $chefs, 'chefs' => true];
            }

            if ([] !== $lines) {
                $stations[] = [...$stop, 'lines' => $lines];
            }
        }

        return $stations;
    }
}
