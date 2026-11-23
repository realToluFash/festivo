<?php

declare(strict_types=1);

namespace App\Domain\Menu\Kitchen;

use App\Domain\Menu\Pick\PicksMenu;
use Psl\Iter;
use Psl\Math;
use Psl\Type;
use Psl\Vec;

/**
 * @phpstan-import-type Course from PicksMenu
 * @phpstan-import-type Spot from PicksMenu
 * @phpstan-import-type Cell from KitchenSheet
 * @phpstan-import-type Counted from KitchenSheet
 * @phpstan-import-type SheetCourse from KitchenSheet
 * @phpstan-import-type SheetStation from KitchenSheet
 */
final readonly class KitchenCourse
{
    /**
     * @param Course $course
     * @param Spot   $spot
     *
     * @return Cell a dish, or `kitchen`, `skipped`, `host`, `changed`, `notYet` or `never`
     */
    public static function cell(array $course, array $spot): array
    {
        return match ($spot['state']) {
            'dish', 'defaulted' => ['kind' => 'dish', 'text' => PicksMenu::plateName($course, $spot['dish'] ?? '', $spot['variant'] ?? null, $spot['options'] ?? [])],
            'kitchen', 'skipped', 'host', 'changed' => ['kind' => $spot['state']],
            default => ['kind' => isset($spot['excluded']) && self::closedWithDefault($course) ? 'never' : 'notYet'],
        };
    }

    /**
     * @param Course              $course
     * @param Counted             $counted
     * @param ?list<SheetStation> $stations sc-34244's By station, null where the course has none
     *
     * @return SheetCourse a dish's count is its chosen and its defaulted together, as See picks counts it
     */
    public static function of(array $course, array $counted, ?array $stations): array
    {
        $rows = Vec\map($counted['rows'], static fn (array $row): array => [
            'id' => $row['id'],
            'kind' => match ($row['kind']) {
                'variant' => 'variant',
                'option' => 'side',
                default => 'dish',
            },
            'name' => $row['name'],
            'count' => $row['chosen'] + $row['defaulted'],
        ]);
        $defaulted = Math\sum(Vec\map(Vec\filter($counted['rows'], static fn (array $row): bool => 'dish' === $row['kind']), static fn (array $row): int => $row['defaulted']));
        $default = $course['default'];

        return [
            'id' => $course['id'],
            'name' => $course['name'],
            'rows' => $rows,
            'kitchen' => $counted['kitchen'],
            'skipped' => $counted['skipped'],
            'needsHost' => $counted['needsHost'],
            'notChosen' => $counted['notChosen'],
            'menuChanged' => $counted['menuChanged'],
            'never' => self::closedWithDefault($course),
            'room' => $counted['room'],
            'given' => null !== $default && $counted['closed'] && $defaulted > 0
                ? ['count' => $defaulted, 'plate' => PicksMenu::plateName($course, $default['dish'], $default['variant'], $default['options'])]
                : null,
            'sides' => Iter\any($counted['rows'], static fn (array $row): bool => 'option' === $row['kind']),
            'stations' => $stations,
        ];
    }

    /** @param Course $course after its close, anyone still without a dish is someone sc-1362 never gives the default */
    private static function closedWithDefault(array $course): bool
    {
        return null !== $course['default'] && ($course['picksClose']['closed'] ?? false);
    }

    /** @return Type\TypeInterface<list<Counted>> */
    public static function countedType(): Type\TypeInterface
    {
        return Type\vec(Type\shape([
            'id' => Type\string(),
            'rows' => Type\vec(Type\shape(['id' => Type\string(), 'kind' => Type\string(), 'name' => Type\string(), 'chosen' => Type\int(), 'defaulted' => Type\int()])),
            'kitchen' => Type\int(),
            'skipped' => Type\int(),
            'needsHost' => Type\int(),
            'notChosen' => Type\int(),
            'menuChanged' => Type\int(),
            'room' => Type\int(),
            'closed' => Type\bool(),
        ]));
    }
}
