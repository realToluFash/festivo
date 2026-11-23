<?php

declare(strict_types=1);

namespace App\Domain\Menu\Kitchen;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Menu\Pick\PicksFigures;
use App\Domain\Menu\Pick\PicksMenu;
use App\Domain\Menu\Pick\PickSpots;
use App\Entity\Event;
use App\Entity\Guest;
use App\Enum\NeedKind;
use App\Enum\Paper;
use Closure;
use Psl\Dict;
use Psl\Iter;
use Psl\Math;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/**
 * The kitchen sheet (sc-3911): who must not eat what, then the diets, then what to cook. Every count is See picks' own (sc-3909), so the two agree at the same moment.
 *
 * @phpstan-import-type Course from PicksMenu
 * @phpstan-import-type Spot from PicksMenu
 *
 * @phpstan-type Cell array{kind: string, text?: string}
 * @phpstan-type Allergic array{id: string, name: string, allergens: list<string>, otherAllergy: ?string, cells: list<Cell>}
 * @phpstan-type Row array{id: string, kind: string, name: string, count: int}
 * @phpstan-type Counted array{id: string, rows: list<array{id: string, kind: string, name: string, chosen: int, defaulted: int}>, kitchen: int, skipped: int, needsHost: int, notChosen: int, room: int, closed: bool}
 * @phpstan-type SheetCourse array{id: string, name: string, rows: list<Row>, kitchen: int, skipped: int, needsHost: int, notChosen: int, never: bool, room: int, given: ?array{count: int, plate: string}, sides: bool}
 * @phpstan-type Sheet array{asOf: string, paper: Paper, names: bool, coming: int, allergicCount: int, allergic: ?list<Allergic>, allergyCounts: list<array{code: string, count: int}>, dietCounts: list<array{code: string, count: int}>, courses: list<SheetCourse>}
 */
final readonly class KitchenSheet
{
    public function __construct(
        private PicksFigures $picksFigures,
        private PicksMenu $picksMenu,
        private PickSpots $pickSpots,
        private GuestNeedsRecord $guestNeedsRecord,
    ) {
    }

    /**
     * @param bool $names guests.manage: Allergies names each person with what they eat; without it, counts per allergen only
     *
     * @return Sheet
     */
    public function of(Event $event, bool $names): array
    {
        $figures = $this->picksFigures->of($event, false);
        $room = $this->picksFigures->room($event);
        $courses = $this->picksMenu->courses($event);
        $needs = $this->guestNeedsRecord->of($room);
        $needsOf = static fn (Guest $person): GuestNeeds => $needs[$person->getId()->toRfc4122()] ?? GuestNeeds::none();
        $allergic = Vec\filter($room, static fn (Guest $person): bool => [] !== $needsOf($person)->codesOf(NeedKind::Allergen));
        $counted = Dict\from_entries(Vec\map(self::countedType()->coerce($figures['courses']), static fn (array $course): array => [$course['id'], $course]));

        return [
            'asOf' => Type\string()->coerce($figures['updatedAt']),
            'paper' => Paper::forCountry($event->getOrganisation()->getCountryCode()),
            'names' => $names,
            'coming' => Iter\count($room),
            'allergicCount' => Iter\count($allergic),
            'allergic' => $names ? $this->allergic($event, $room, $allergic, $courses, $needsOf) : null,
            'allergyCounts' => self::counts($room, $needsOf, NeedKind::Allergen),
            'dietCounts' => self::counts($room, $needsOf, NeedKind::Diet),
            'courses' => Vec\map($courses, static fn (array $course): array => self::course($course, $counted[$course['id']])),
        ];
    }

    /**
     * @param list<Guest>                $room
     * @param list<Guest>                $allergic
     * @param list<Course>               $courses
     * @param Closure(Guest): GuestNeeds $needsOf
     *
     * @return list<Allergic> by name
     */
    private function allergic(Event $event, array $room, array $allergic, array $courses, Closure $needsOf): array
    {
        $spots = $this->pickSpots->of($event, $room, $courses);
        $sorted = Vec\sort($allergic, static function (Guest $a, Guest $b): int {
            $byName = Str\Byte\compare_ci($a->getFullName() ?? '', $b->getFullName() ?? '');

            return 0 !== $byName ? $byName : Str\Byte\compare($a->getId()->toRfc4122(), $b->getId()->toRfc4122());
        });

        return Vec\map($sorted, static function (Guest $person) use ($spots, $courses, $needsOf): array {
            $id = $person->getId()->toRfc4122();
            $needs = $needsOf($person);

            return [
                'id' => $id,
                'name' => $person->getFullName() ?? '',
                'allergens' => $needs->codesOf(NeedKind::Allergen),
                'otherAllergy' => $needs->otherOf(NeedKind::Allergen),
                'cells' => Vec\map($courses, static fn (array $course): array => self::cell($course, $spots[$course['id']][$id])),
            ];
        });
    }

    /**
     * @param Course $course
     * @param Spot   $spot
     *
     * @return Cell a dish, or `kitchen`, `skipped`, `host`, `notYet` or `never`
     */
    private static function cell(array $course, array $spot): array
    {
        return match ($spot['state']) {
            'dish', 'defaulted' => ['kind' => 'dish', 'text' => PicksMenu::plateName($course, $spot['dish'] ?? '', $spot['variant'] ?? null, $spot['options'] ?? [])],
            'kitchen', 'skipped', 'host' => ['kind' => $spot['state']],
            default => ['kind' => isset($spot['excluded']) && self::closedWithDefault($course) ? 'never' : 'notYet'],
        };
    }

    /**
     * @param Course  $course
     * @param Counted $counted
     *
     * @return SheetCourse a dish's count is its chosen and its defaulted together, as See picks counts it
     */
    private static function course(array $course, array $counted): array
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
            'never' => self::closedWithDefault($course),
            'room' => $counted['room'],
            'given' => null !== $default && $counted['closed'] && $defaulted > 0
                ? ['count' => $defaulted, 'plate' => PicksMenu::plateName($course, $default['dish'], $default['variant'], $default['options'])]
                : null,
            'sides' => Iter\any($counted['rows'], static fn (array $row): bool => 'option' === $row['kind']),
        ];
    }

    /** @param Course $course after its close, anyone still without a dish is someone sc-1362 never gives the default */
    private static function closedWithDefault(array $course): bool
    {
        return null !== $course['default'] && ($course['picksClose']['closed'] ?? false);
    }

    /**
     * @param list<Guest>                $room
     * @param Closure(Guest): GuestNeeds $needsOf
     *
     * @return list<array{code: string, count: int}> in the list's own order, Other last, only the codes someone has
     */
    private static function counts(array $room, Closure $needsOf, NeedKind $kind): array
    {
        $counts = Vec\map($kind->codes(), static fn (string $code): array => [
            'code' => $code,
            'count' => Iter\count(Vec\filter($room, static fn (Guest $person): bool => Iter\contains($needsOf($person)->codesOf($kind), $code))),
        ]);

        return Vec\filter($counts, static fn (array $one): bool => $one['count'] > 0);
    }

    /** @return Type\TypeInterface<list<Counted>> */
    private static function countedType(): Type\TypeInterface
    {
        return Type\vec(Type\shape([
            'id' => Type\string(),
            'rows' => Type\vec(Type\shape(['id' => Type\string(), 'kind' => Type\string(), 'name' => Type\string(), 'chosen' => Type\int(), 'defaulted' => Type\int()], true)),
            'kitchen' => Type\int(),
            'skipped' => Type\int(),
            'needsHost' => Type\int(),
            'notChosen' => Type\int(),
            'room' => Type\int(),
            'closed' => Type\bool(),
        ], true));
    }
}
