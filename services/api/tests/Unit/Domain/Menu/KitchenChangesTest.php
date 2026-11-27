<?php

declare(strict_types=1);

namespace App\Tests\Unit\Domain\Menu;

use App\Domain\Menu\Kitchen\KitchenChanges;
use App\Tests\Fixtures\KitchenSides;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Dict;
use Psl\Str;
use Psl\Vec;

/**
 * @phpstan-import-type Person from KitchenChanges
 * @phpstan-import-type Side from KitchenChanges
 */
final class KitchenChangesTest extends TestCase
{
    #[Test]
    public function anAllergyAndADietAreSaidAsRecordedRemovedAndAsTwoLinesWhenChanged(): void
    {
        $copy = [KitchenSides::person('a', 'Ada', ['sesame'], ['halal']), KitchenSides::person('b', 'Bo', ['milk'])];
        $now = [KitchenSides::person('a', 'Ada', ['peanuts'], ['vegan']), KitchenSides::person('b', 'Bo', ['milk', 'fish'])];

        self::assertSame(
            ['allergyNew:peanuts:Ada:1', 'allergyGone:sesame:Ada:1', 'allergyNew:fish:Bo:1', 'dietNew:vegan:Ada:1', 'dietGone:halal:Ada:1'],
            self::said(KitchenSides::side($copy), KitchenSides::side($now), true),
        );
        self::assertSame(
            ['allergyNew:fish::1', 'allergyNew:peanuts::1', 'allergyGone:sesame::1', 'dietNew:vegan::1', 'dietGone:halal::1'],
            self::said(KitchenSides::side($copy), KitchenSides::side($now), false),
        );
    }

    #[Test]
    public function countsArePerCodeAndDirectionAndNeverNetted(): void
    {
        $copy = [KitchenSides::person('a', 'Ada', ['peanuts']), KitchenSides::person('b', 'Bo', ['milk'])];
        $now = [KitchenSides::person('a', 'Ada', []), KitchenSides::person('b', 'Bo', ['milk', 'peanuts'])];

        self::assertSame(['allergyNew:peanuts::1', 'allergyGone:peanuts::1'], self::said(KitchenSides::side($copy), KitchenSides::side($now, room: $now), false));
    }

    #[Test]
    public function countsAboveOneAreSummed(): void
    {
        $now = [KitchenSides::person('a', 'Ada', ['sesame'], ['halal']), KitchenSides::person('b', 'Bo', ['sesame'], ['halal'])];

        self::assertSame(['allergyNew:sesame::2', 'dietNew:halal::2', 'comingMore:::2'], self::said(KitchenSides::side([]), KitchenSides::side($now, coming: 12), false));
        self::assertSame(['allergyGone:sesame::2', 'dietGone:halal::2', 'comingFewer:::2'], self::said(KitchenSides::side($now, coming: 12), KitchenSides::side([]), false));
    }

    #[Test]
    public function aDietAmongGuestsWithNoAllergyIsACountForEveryReader(): void
    {
        $copy = KitchenSides::side([], diets: ['halal' => 3, 'vegan' => 1]);
        $now = KitchenSides::side([], diets: ['halal' => 2, 'vegan' => 3]);

        self::assertSame(['dietNew:vegan::2', 'dietGone:halal::1'], self::said($copy, $now, true));
    }

    #[Test]
    public function aGuestErasedSinceTheCopyIsOnlyEverACount(): void
    {
        $copy = KitchenSides::side([], allergies: ['fish' => 1], diets: ['halal' => 1], coming: 11);

        self::assertSame(['allergyGone:fish::1', 'dietGone:halal::1', 'comingFewer:::1'], self::said($copy, KitchenSides::side([]), true));
    }

    #[Test]
    public function aPersonWhoStartsOrStopsComingBringsOrTakesWhatTheyEat(): void
    {
        $ada = [KitchenSides::person('a', 'Ada', ['sesame'])];

        self::assertSame(['allergyNew:sesame:Ada:1', 'comingMore:::1'], self::said(KitchenSides::side([], coming: 10), KitchenSides::side($ada, coming: 11), true));
        self::assertSame(['allergyGone:sesame:Ada:1', 'comingFewer:::1'], self::said(KitchenSides::side($ada, coming: 11), KitchenSides::side([], coming: 10), true));
    }

    #[Test]
    public function aDietThatOnlyMovesBetweenTheNamesAndTheOtherDietsIsNoChange(): void
    {
        $ada = KitchenSides::person('a', 'Ada', [], ['vegan']);
        $copy = KitchenSides::side([$ada], diets: ['vegan' => 1]);
        $now = KitchenSides::side([], diets: ['vegan' => 1]);

        self::assertSame([], self::saidBetween(KitchenChanges::between($copy, $now, ['a' => $ada]), true));

        $both = KitchenSides::person('a', 'Ada', ['sesame'], ['vegan']);
        $copy = KitchenSides::side([$both], diets: ['vegan' => 1]);

        self::assertSame(['allergyGone:sesame:Ada:1'], self::saidBetween(KitchenChanges::between($copy, $now, ['a' => $ada]), true));

        $quin = KitchenSides::person('q', 'Quin', ['sesame'], ['halal']);
        $copy = KitchenSides::side([], diets: ['halal' => 1]);

        self::assertSame(['allergyNew:sesame:Quin:1'], self::said($copy, KitchenSides::side([$quin]), true));
    }

    #[Test]
    public function aDeletedCoursesOtherFiguresGoToNought(): void
    {
        $copy = KitchenSides::side([]);
        $copy['courses'][0]['kitchen'] = 12;
        $copy['courses'][0]['skipped'] = 3;
        $now = [...KitchenSides::side([]), 'courses' => []];

        self::assertSame(['kitchen 12 0', 'skipped 3 0'], Vec\map(KitchenChanges::between($copy, $now, []), static fn (array $line): string => Str\join([$line['item']['state'] ?? '', (string) $line['old'], (string) $line['count']], ' ')));
    }

    #[Test]
    public function anotherAllergyRewordedIsRemovedAndRecorded(): void
    {
        $kiwi = [...KitchenSides::person('a', 'Ada', ['other']), 'otherAllergy' => 'Kiwi'];
        $mango = [...$kiwi, 'otherAllergy' => 'Mango'];

        self::assertSame(['allergyNew:other:Ada:1', 'allergyGone:other:Ada:1'], self::said(KitchenSides::side([$kiwi]), KitchenSides::side([$mango]), true));
    }

    #[Test]
    public function dishesVariantsAndSidesAreMatchedByRecordAndNamedAfterTheirDish(): void
    {
        $copy = KitchenSides::side([], rows: [
            KitchenSides::row('j', 'dish', 'Jollof rice', 48),
            KitchenSides::row('jf', 'variant', 'Fish', 41),
            KitchenSides::row('jb', 'variant', 'Beef', 7),
            KitchenSides::row('jp', 'side', 'Plantain', 33),
            KitchenSides::row('ja', 'side', 'Akara', 5),
            KitchenSides::row('js', 'side', 'Slaw', 9),
            KitchenSides::row('f', 'dish', 'Fish', 6),
            KitchenSides::row('q', 'dish', 'Quiet', 0),
            KitchenSides::row('b', 'dish', 'Bass', 30),
        ]);
        $now = KitchenSides::side([], rows: [
            KitchenSides::row('j', 'dish', 'Jollof', 48),
            KitchenSides::row('jf', 'variant', 'Sea bass', 40),
            KitchenSides::row('jc', 'variant', 'Chicken', 6),
            KitchenSides::row('jp', 'side', 'Plantain', 35),
            KitchenSides::row('js', 'side', 'Coleslaw', 9),
            KitchenSides::row('jd', 'side', 'Dodo', 4),
            KitchenSides::row('n', 'dish', 'Moi moi', 1),
            KitchenSides::row('b', 'dish', 'Bass', 30),
            KitchenSides::row('z', 'dish', 'Nobody yet', 0),
        ]);

        self::assertSame([
            'renamed|Jollof rice||Jollof|0|0',
            'renamed|Fish|Jollof||0|0',
            'count|Sea bass|Jollof||41|40',
            'removed|Beef|Jollof||0|7',
            'added|Chicken|Jollof||0|6',
            'count|Plantain|Jollof||33|35',
            'removed|Akara|Jollof||0|5',
            'renamed|Slaw|Jollof||0|0',
            'removed|Fish|||0|6',
            'added|Dodo|Jollof||0|4',
            'added|Moi moi|||0|1',
        ], Vec\map(KitchenChanges::between($copy, $now, []), static fn (array $line): string => Str\join([$line['kind'], $line['item']['name'] ?? '', $line['item']['parent'] ?? '', 'renamed' === $line['kind'] && null === ($line['item']['parent'] ?? null) ? $line['to'] ?? '' : '', (string) $line['old'], (string) $line['count']], '|')));
    }

    #[Test]
    public function aFigureThatMovedAndMovedBackAndACoursesNameAreNoChange(): void
    {
        $copy = KitchenSides::side([], rows: [KitchenSides::row('j', 'dish', 'Jollof rice', 48)]);
        $now = $copy;
        $now['courses'][0]['name'] = 'Mains';

        self::assertSame([], KitchenChanges::between($copy, $now, []));
    }

    #[Test]
    public function aCoursesOtherFiguresChangeToo(): void
    {
        $copy = KitchenSides::side([]);
        $now = KitchenSides::side([]);
        $now['courses'][0]['notChosen'] = 3;

        self::assertSame([['name' => '', 'parent' => null, 'state' => 'notYet']], Vec\map(KitchenChanges::between($copy, $now, []), static fn (array $line): ?array => $line['item']));
    }

    /**
     * @param Side $copy
     * @param Side $now
     *
     * @return list<string>
     */
    private static function said(array $copy, array $now, bool $names): array
    {
        $room = Dict\from_entries(Vec\map($now['people'], static fn (array $one): array => [$one['id'], $one]));

        return self::saidBetween(KitchenChanges::between($copy, $now, $room), $names);
    }

    /** @return list<string> */
    private static function saidBetween(mixed $lines, bool $names): array
    {
        return Vec\map(KitchenChanges::forReader($lines, $names), static fn (array $line): string => Str\join([$line['kind'], $line['code'] ?? '', $line['who'] ?? '', (string) $line['count']], ':'));
    }
}
