<?php

declare(strict_types=1);

namespace App\Tests\Fixtures;

use Psl\Dict;
use Psl\Type;
use Psl\Vec;

/**
 * @phpstan-import-type Person from \App\Domain\Menu\Kitchen\KitchenChanges
 * @phpstan-import-type Side from \App\Domain\Menu\Kitchen\KitchenChanges
 * @phpstan-import-type Row from \App\Domain\Menu\Kitchen\KitchenSheet
 */
final readonly class KitchenSides
{
    /**
     * @param list<string> $allergens
     * @param list<string> $diets
     *
     * @return Person
     */
    public static function person(string $id, string $name, array $allergens, array $diets = []): array
    {
        return ['id' => $id, 'name' => $name, 'allergens' => $allergens, 'otherAllergy' => null, 'diets' => $diets, 'otherDiet' => null];
    }

    /** @return Row */
    public static function row(string $id, string $kind, string $name, int $count): array
    {
        return ['id' => $id, 'kind' => $kind, 'name' => $name, 'count' => $count];
    }

    /**
     * @param list<Person>        $people
     * @param ?array<string, int> $allergies
     * @param ?array<string, int> $diets
     * @param list<Row>           $rows
     * @param ?list<Person>       $room
     *
     * @return Side
     */
    public static function side(array $people, ?array $allergies = null, ?array $diets = null, int $coming = 10, array $rows = [], ?array $room = null): array
    {
        $counts = static function (string $field) use ($people, $room): array {
            $codes = Vec\flat_map($room ?? $people, static fn (array $one): array => 'allergens' === $field ? $one['allergens'] : $one['diets']);

            return Dict\count_values($codes);
        };
        $listed = static fn (array $held): array => Vec\map(Vec\keys($held), static fn (int|string $code): array => ['code' => (string) $code, 'count' => Type\int()->coerce($held[$code])]);

        return [
            'coming' => $coming,
            'people' => $people,
            'allergyCounts' => $listed($allergies ?? $counts('allergens')),
            'dietCounts' => $listed($diets ?? $counts('diets')),
            'courses' => [['id' => 'main', 'name' => 'Main', 'rows' => $rows, 'kitchen' => 0, 'skipped' => 0, 'needsHost' => 0, 'notChosen' => 0, 'menuChanged' => 0, 'never' => false, 'room' => $coming, 'given' => null, 'sides' => false, 'stations' => null]],
        ];
    }
}
