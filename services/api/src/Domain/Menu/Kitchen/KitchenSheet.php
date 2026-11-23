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
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/**
 * The kitchen sheet (sc-3911): who must not eat what, then the diets, then what to cook. Every count is See picks' own (sc-3909), so the two agree at the same moment.
 *
 * @phpstan-import-type Course from PicksMenu
 *
 * @phpstan-type Cell array{kind: string, text?: string}
 * @phpstan-type Allergic array{id: string, name: string, allergens: list<string>, otherAllergy: ?string, diets: list<string>, otherDiet: ?string, cells: list<Cell>}
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

    /** @return Sheet Allergies names each person, with what they eat, only when $names (guests.manage) */
    public function of(Event $event, bool $names): array
    {
        $figures = $this->picksFigures->of($event, false);
        $room = $this->picksFigures->room($event);
        $courses = $this->picksMenu->courses($event);
        $needs = $this->guestNeedsRecord->of($room);
        $needsOf = static fn (Guest $person): GuestNeeds => $needs[$person->getId()->toRfc4122()] ?? GuestNeeds::none();
        $allergic = Vec\filter($room, static fn (Guest $person): bool => [] !== $needsOf($person)->codesOf(NeedKind::Allergen));
        $counts = static fn (NeedKind $kind): array => Vec\filter(
            Vec\map($kind->codes(), static fn (string $code): array => [
                'code' => $code,
                'count' => Iter\count(Vec\filter($room, static fn (Guest $person): bool => Iter\contains($needsOf($person)->codesOf($kind), $code))),
            ]),
            static fn (array $one): bool => $one['count'] > 0,
        );
        $counted = Dict\from_entries(Vec\map(KitchenCourse::countedType()->coerce($figures['courses']), static fn (array $course): array => [$course['id'], $course]));

        return [
            'asOf' => Type\string()->coerce($figures['updatedAt']),
            'paper' => Paper::forCountry($event->getOrganisation()->getCountryCode()),
            'names' => $names,
            'coming' => Iter\count($room),
            'allergicCount' => Iter\count($allergic),
            'allergic' => $names ? $this->named($event, $room, $courses, $needsOf) : null,
            'allergyCounts' => $counts(NeedKind::Allergen),
            'dietCounts' => $counts(NeedKind::Diet),
            'courses' => Vec\map($courses, static fn (array $course): array => KitchenCourse::of($course, $counted[$course['id']])),
        ];
    }

    /**
     * @param list<Guest>                $room
     * @param list<Course>               $courses
     * @param Closure(Guest): GuestNeeds $needsOf
     *
     * @return list<Allergic> by name: everyone with an allergen, and everyone sc-1362 never gave a closed course's default, a diet alone included
     */
    private function named(Event $event, array $room, array $courses, Closure $needsOf): array
    {
        $spots = $this->pickSpots->of($event, $room, $courses);
        $rows = Vec\map($room, static function (Guest $person) use ($spots, $courses, $needsOf): array {
            $id = $person->getId()->toRfc4122();
            $needs = $needsOf($person);

            return [
                'id' => $id,
                'name' => $person->getFullName() ?? '',
                'allergens' => $needs->codesOf(NeedKind::Allergen),
                'otherAllergy' => $needs->otherOf(NeedKind::Allergen),
                'diets' => $needs->codesOf(NeedKind::Diet),
                'otherDiet' => $needs->otherOf(NeedKind::Diet),
                'cells' => Vec\map($courses, static fn (array $course): array => KitchenCourse::cell($course, $spots[$course['id']][$id])),
            ];
        });
        $named = Vec\filter($rows, static fn (array $row): bool => [] !== $row['allergens'] || Iter\any($row['cells'], static fn (array $cell): bool => 'never' === $cell['kind']));

        return Vec\sort($named, static function (array $a, array $b): int {
            $byName = Str\Byte\compare_ci($a['name'], $b['name']);

            return 0 !== $byName ? $byName : Str\Byte\compare($a['id'], $b['id']);
        });
    }
}
