<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Seating\SectionColourPicker;
use App\Domain\Seating\SectionNameNormaliser;
use App\Enum\MeasurementSystem;
use App\Enum\SectionColour;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/** A section's name, its default colour and the room's units (sc-3998). */
final class SeatingRulesTest extends TestCase
{
    /** @return iterable<string, array{string, string}> */
    public static function sameNames(): iterable
    {
        yield 'case' => ['Terrace', 'TERRACE'];
        yield 'accents' => ['Terrasse', 'terrassé'];
        yield 'a decomposed accent' => ["Pe\u{0301}rgola", 'Pérgola'];
        yield 'spaces around and between' => ['  Main   hall ', 'main hall'];
    }

    #[Test]
    #[DataProvider('sameNames')]
    public function twoNamesDifferingOnlyInCaseOrAccentsAreOne(string $one, string $other): void
    {
        self::assertSame(SectionNameNormaliser::key($one), SectionNameNormaliser::key($other));
    }

    #[Test]
    public function differentLettersAreDifferentNames(): void
    {
        self::assertNotSame(SectionNameNormaliser::key('Hall A'), SectionNameNormaliser::key('Hall B'));
    }

    #[Test]
    public function aNameIsKeptAsTypedTrimmed(): void
    {
        self::assertSame('Terrassé du jardin', SectionNameNormaliser::name("  Terrassé \t du jardin "));
    }

    #[Test]
    public function theFirstSectionIsBlue(): void
    {
        self::assertSame(SectionColour::Blue, SectionColourPicker::leastUsed([]));
    }

    #[Test]
    public function aNewSectionTakesTheLeastUsedColour(): void
    {
        self::assertSame(SectionColour::Plum, SectionColourPicker::leastUsed([SectionColour::Blue, SectionColour::Purple]));
        self::assertSame(SectionColour::Blue, SectionColourPicker::leastUsed(SectionColour::cases()));
    }

    #[Test]
    public function aTieGoesToTheFirstInPaletteOrder(): void
    {
        $taken = [...SectionColour::cases(), SectionColour::Blue, SectionColour::Teal, SectionColour::Plum];

        self::assertSame(SectionColour::Purple, SectionColourPicker::leastUsed($taken));
    }

    /** @return iterable<string, array{string, MeasurementSystem}> */
    public static function territories(): iterable
    {
        yield 'the United States' => ['US', MeasurementSystem::UsCustomary];
        yield 'Liberia' => ['LR', MeasurementSystem::UsCustomary];
        yield 'Nigeria' => ['NG', MeasurementSystem::Metric];
        yield 'the United Kingdom' => ['GB', MeasurementSystem::Metric];
        yield 'lowercase' => ['us', MeasurementSystem::UsCustomary];
    }

    #[Test]
    #[DataProvider('territories')]
    public function feetAndInchesAreForUsCustomaryCountriesAlone(string $country, MeasurementSystem $expected): void
    {
        self::assertSame($expected, MeasurementSystem::forTerritory($country));
    }

    #[Test]
    public function theLimitsAreWrittenInEachSystemToTheWholeInch(): void
    {
        self::assertSame('2 m', MeasurementSystem::Metric->written(200, 'en'));
        self::assertSame('500 m', MeasurementSystem::Metric->written(50_000, 'en'));
        self::assertSame('6 ft 7 in', MeasurementSystem::UsCustomary->written(200, 'en'));
        self::assertSame('1640 ft 5 in', MeasurementSystem::UsCustomary->written(50_000, 'en'));
        self::assertSame('12 ft', MeasurementSystem::UsCustomary->written(366, 'en'));
    }

    #[Test]
    public function theLimitsAreWrittenInTheReadersLanguageWithNoGrouping(): void
    {
        self::assertSame("1640\u{202F}pi 5\u{202F}po", MeasurementSystem::UsCustomary->written(50_000, 'fr'));
        self::assertSame('1640 ft 5 pol.', MeasurementSystem::UsCustomary->written(50_000, 'pt'));
        self::assertSame("2,5\u{202F}m", MeasurementSystem::Metric->written(250, 'fr'));
    }
}
