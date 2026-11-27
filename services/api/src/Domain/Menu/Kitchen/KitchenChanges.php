<?php

declare(strict_types=1);

namespace App\Domain\Menu\Kitchen;

use App\Enum\NeedKind;
use Psl\Dict;
use Psl\Iter;
use Psl\Math;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/**
 * @phpstan-import-type Sheet from KitchenSheet
 * @phpstan-import-type SheetCourse from KitchenSheet
 *
 * @phpstan-type Person array{id: string, name: ?string, allergens: list<string>, otherAllergy: ?string, diets: list<string>, otherDiet: ?string}
 * @phpstan-type Item array{name: string, parent: ?string, state: ?string}
 * @phpstan-type Line array{kind: string, code: ?string, guest: ?string, who: ?string, item: ?Item, to: ?string, old: int, count: int}
 * @phpstan-type Side array{coming: int, people: list<Person>, allergyCounts: list<array{code: string, count: int}>, dietCounts: list<array{code: string, count: int}>, courses: list<SheetCourse>}
 */
final readonly class KitchenChanges
{
    /**
     * @param Side                  $copy rows only for people it names or with an allergy: counts above them are guests never named, or since erased
     * @param Side                  $now
     * @param array<string, Person> $room
     * @param array<string, string> $gone
     *
     * @return list<Line>
     */
    public static function between(array $copy, array $now, array $room, array $gone = []): array
    {
        $before = Dict\from_entries(Vec\map($copy['people'], static fn (array $one): array => [$one['id'], $one]));
        // Only a person the copy holds, or one with an allergy now, is compared by person: a diet alone is a count (GDPR Art. 5(1)(c)).
        $listed = Vec\filter($now['people'], static fn (array $one): bool => [] !== $one['allergens'] && !Iter\contains_key($before, $one['id']));
        $stayed = [];

        foreach (Vec\keys($before) as $id) {
            if (Iter\contains_key($room, $id)) {
                $stayed[$id] = $room[$id];
            }
        }

        $after = Dict\merge(Dict\from_entries(Vec\map($listed, static fn (array $one): array => [$one['id'], $one])), $stayed);

        // The copy does not say what a newly named person ate: their diet is news only where the sheet has more of it than the others explain.
        $unexplained = [];

        foreach (NeedKind::Diet->codes() as $code) {
            $unexplained[$code] = self::unnamed($now['dietCounts'], Vec\values($stayed), 'diets', $code) - self::unnamed($copy['dietCounts'], $copy['people'], 'diets', $code);
        }

        $lines = [];

        foreach (Vec\unique(Vec\concat(Vec\keys($after), Vec\keys($before))) as $id) {
            $was = $before[$id] ?? null;
            $is = $after[$id] ?? null;
            $who = $is['name'] ?? $was['name'] ?? $gone[$id] ?? null;

            foreach (['allergy' => ['allergens', 'otherAllergy'], 'diet' => ['diets', 'otherDiet']] as $family => [$field, $other]) {
                $had = null === $was ? [] : $was[$field];
                $has = null === $is ? [] : $is[$field];
                $reworded = null !== ($was[$other] ?? null) && null !== ($is[$other] ?? null) && $was[$other] !== $is[$other];
                $moved = static fn (array $from, array $against): array => Vec\filter($from, static fn (string $code): bool => !Iter\contains($against, $code) || ($reworded && 'other' === $code));

                foreach ($moved($has, $had) as $code) {
                    if ('diet' === $family && null === $was) {
                        if (($unexplained[$code] ?? 0) <= 0) {
                            continue;
                        }

                        --$unexplained[$code];
                    }

                    $lines[] = self::need($family . 'New', $code, $id, $who, 1);
                }

                foreach ($moved($had, $has) as $code) {
                    $lines[] = self::need($family . 'Gone', $code, $id, $who, 1);
                }
            }
        }

        // What the figure moved by beyond the lines above: a diet that only moved between a named row and the figure is no change.
        foreach (['allergy' => [NeedKind::Allergen, 'allergyCounts'], 'diet' => [NeedKind::Diet, 'dietCounts']] as $family => [$kind, $counts]) {
            foreach ($kind->codes() as $code) {
                $said = Iter\count(Vec\filter($lines, static fn (array $line): bool => $line['code'] === $code && $line['kind'] === $family . 'New'))
                    - Iter\count(Vec\filter($lines, static fn (array $line): bool => $line['code'] === $code && $line['kind'] === $family . 'Gone'));
                $change = self::total($now[$counts], $code) - self::total($copy[$counts], $code) - $said;

                if (0 !== $change) {
                    $lines[] = self::need($family . ($change > 0 ? 'New' : 'Gone'), $code, null, null, Math\abs($change));
                }
            }
        }

        $coming = $now['coming'] - $copy['coming'];

        if (0 !== $coming) {
            $lines[] = self::line($coming > 0 ? 'comingMore' : 'comingFewer', count: Math\abs($coming));
        }

        return Vec\concat($lines, KitchenCourseChanges::between($copy['courses'], $now['courses']));
    }

    /** @return list<Line> under the names rule: a count per code and per direction, never netted */
    public static function forReader(mixed $lines, bool $names): array
    {
        $lines = self::linesType()->coerce($lines);
        $out = [];

        foreach (['allergy' => NeedKind::Allergen, 'diet' => NeedKind::Diet] as $family => $kind) {
            $own = Vec\filter($lines, static fn (array $line): bool => Str\starts_with($line['kind'], $family));
            $isNamed = static fn (array $line): bool => $names && null !== $line['who'];
            $out = Vec\concat($out, Vec\filter($own, $isNamed));
            $counted = Vec\filter($own, static fn (array $line): bool => !$isNamed($line));

            foreach ($kind->codes() as $code) {
                foreach (['New', 'Gone'] as $way) {
                    $count = Math\sum(Vec\map(Vec\filter($counted, static fn (array $line): bool => $line['code'] === $code && $line['kind'] === $family . $way), static fn (array $line): int => $line['count']));

                    if ($count > 0) {
                        $out[] = self::need($family . $way, $code, null, null, $count);
                    }
                }
            }
        }

        return Vec\concat($out, Vec\filter($lines, static fn (array $line): bool => !Str\starts_with($line['kind'], 'allergy') && !Str\starts_with($line['kind'], 'diet')));
    }

    /** @return Type\TypeInterface<list<Line>> */
    public static function linesType(): Type\TypeInterface
    {
        return Type\vec(Type\shape([
            'kind' => Type\string(),
            'code' => Type\nullable(Type\string()),
            'guest' => Type\nullable(Type\string()),
            'who' => Type\nullable(Type\string()),
            'item' => Type\nullable(self::itemType()),
            'to' => Type\nullable(Type\string()),
            'old' => Type\int(),
            'count' => Type\int(),
        ]));
    }

    private static function unnamed(mixed $counts, mixed $people, string $field, string $code): int
    {
        $people = Type\vec(Type\shape([$field => Type\vec(Type\string())], true))->coerce($people);
        $held = Iter\count(Vec\filter($people, static fn (array $person): bool => Iter\contains(Type\vec(Type\string())->coerce($person[$field] ?? []), $code)));

        return Math\maxva(self::total($counts, $code) - $held, 0);
    }

    private static function total(mixed $counts, string $code): int
    {
        $counts = Type\vec(Type\shape(['code' => Type\string(), 'count' => Type\int()]))->coerce($counts);

        return Iter\search($counts, static fn (array $one): bool => $one['code'] === $code)['count'] ?? 0;
    }

    /** @return Line */
    private static function need(string $kind, string $code, ?string $guest, ?string $who, int $count): array
    {
        return self::line($kind, code: $code, guest: $guest, who: $who, count: $count);
    }

    /** @return Line */
    public static function line(string $kind, ?string $code = null, ?string $guest = null, ?string $who = null, mixed $item = null, ?string $to = null, int $old = 0, int $count = 0): array
    {
        return ['kind' => $kind, 'code' => $code, 'guest' => $guest, 'who' => $who, 'item' => null === $item ? null : self::itemType()->coerce($item), 'to' => $to, 'old' => $old, 'count' => $count];
    }

    /** @return Type\TypeInterface<Item> */
    private static function itemType(): Type\TypeInterface
    {
        return Type\shape(['name' => Type\string(), 'parent' => Type\nullable(Type\string()), 'state' => Type\nullable(Type\string())]);
    }
}
