<?php

declare(strict_types=1);

namespace App\Domain\Menu\Kitchen;

use Psl\Dict;
use Psl\Iter;
use Psl\Math;
use Psl\Vec;

/**
 * @phpstan-import-type SheetCourse from KitchenSheet
 * @phpstan-import-type Row from KitchenSheet
 * @phpstan-import-type Line from KitchenChanges
 *
 * @phpstan-type Placed array{course: string, row: Row, parent: ?Row}
 */
final readonly class KitchenCourseChanges
{
    private const array STATES = ['kitchen', 'skipped', 'needsHost', 'menuChanged', 'notChosen'];

    /** @return list<Line> a row gone since the copy stands where it did */
    public static function between(mixed $copy, mixed $now): array
    {
        $copy = FinalNumbers::coursesType()->coerce($copy);
        $now = FinalNumbers::coursesType()->coerce($now);
        $was = self::placed($copy);
        $is = self::placed($now);
        $kept = Vec\map($now, static fn (array $course): string => $course['id']);
        $order = Vec\concat($now, Vec\filter($copy, static fn (array $course): bool => !Iter\contains($kept, $course['id'])));
        $lines = [];

        foreach ($order as $course) {
            $ids = Vec\keys(Dict\filter($is, static fn (array $placed): bool => $placed['course'] === $course['id']));
            /** @var non-negative-int $at where the next row gone since the copy goes */
            $at = 0;

            foreach ($was as $id => $placed) {
                if ($placed['course'] !== $course['id']) {
                    continue;
                }

                if (Iter\contains_key($is, $id)) {
                    $position = self::position($ids, $id);
                    $at = null === $position ? $at : Math\maxva($position + 1, 0);

                    continue;
                }

                $ids = Vec\concat(Vec\take($ids, $at), [$id], Vec\drop($ids, $at));
                ++$at;
            }

            foreach ($ids as $id) {
                $lines = Vec\concat($lines, self::rowLines($was[$id] ?? null, $is[$id] ?? null, $was, $is));
            }

            $before = Iter\search($copy, static fn (array $one): bool => $one['id'] === $course['id']);
            $after = Iter\search($now, static fn (array $one): bool => $one['id'] === $course['id']);

            if (null === $after) {
                continue;
            }

            foreach (self::STATES as $state) {
                $old = null === $before ? 0 : self::figure($before, $state);
                $new = self::figure($after, $state);

                if ($old !== $new) {
                    $shown = match (true) {
                        'notChosen' !== $state => $state,
                        $after['never'] => 'never',
                        default => 'notYet',
                    };
                    $lines[] = KitchenChanges::line('count', item: ['name' => '', 'parent' => null, 'state' => $shown], old: $old, count: $new);
                }
            }
        }

        return $lines;
    }

    /** @param SheetCourse $course */
    private static function figure(array $course, string $state): int
    {
        return match ($state) {
            'kitchen' => $course['kitchen'],
            'skipped' => $course['skipped'],
            'needsHost' => $course['needsHost'],
            'menuChanged' => $course['menuChanged'],
            default => $course['notChosen'],
        };
    }

    /** @param list<string> $ids */
    private static function position(array $ids, string $id): ?int
    {
        foreach ($ids as $at => $one) {
            if ($one === $id) {
                return $at;
            }
        }

        return null;
    }

    /** @return array<string, Placed> by the row's record; a variant or a side with the dish above it */
    private static function placed(mixed $courses): array
    {
        $placed = [];

        foreach (FinalNumbers::coursesType()->coerce($courses) as $course) {
            $dish = null;

            foreach ($course['rows'] as $row) {
                $dish = 'dish' === $row['kind'] ? $row : $dish;
                $placed[$row['id']] = ['course' => $course['id'], 'row' => $row, 'parent' => 'dish' === $row['kind'] ? null : $dish];
            }
        }

        return $placed;
    }

    /**
     * @param ?Placed               $before
     * @param ?Placed               $after
     * @param array<string, Placed> $was
     * @param array<string, Placed> $is
     *
     * @return list<Line>
     */
    private static function rowLines(?array $before, ?array $after, array $was, array $is): array
    {
        $placed = $after ?? $before;

        if (null === $placed) {
            return [];
        }

        $parent = $placed['parent'];
        $dish = null === $parent ? null : ($is[$parent['id']]['row']['name'] ?? $was[$parent['id']]['row']['name'] ?? $parent['name']);
        $item = static fn (string $name): array => ['name' => $name, 'parent' => $dish, 'state' => null];
        $row = $placed['row'];

        if (null === $before) {
            return $row['count'] > 0 ? [KitchenChanges::line('added', item: $item($row['name']), count: $row['count'])] : [];
        }

        if (null === $after) {
            return $row['count'] > 0 ? [KitchenChanges::line('removed', item: $item($row['name']), count: $row['count'])] : [];
        }

        $lines = $before['row']['name'] === $row['name'] ? [] : [KitchenChanges::line('renamed', item: $item($before['row']['name']), to: $row['name'])];

        return $before['row']['count'] === $row['count'] ? $lines : [...$lines, KitchenChanges::line('count', item: $item($row['name']), old: $before['row']['count'], count: $row['count'])];
    }
}
