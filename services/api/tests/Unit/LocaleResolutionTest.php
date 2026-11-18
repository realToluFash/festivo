<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Locale\SupportedLocales;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class LocaleResolutionTest extends TestCase
{
    #[Test]
    #[DataProvider('tags')]
    public function itNarrowsTheTagsClientsActuallySend(string $sent, string $expected): void
    {
        self::assertSame($expected, SupportedLocales::narrow($sent));
    }

    /** @return iterable<string, array{string, string}> */
    public static function tags(): iterable
    {
        yield 'plain' => ['fr', 'fr'];
        yield 'regional' => ['pt-BR', 'pt'];
        yield 'underscored' => ['es_ES', 'es'];
        yield 'uppercase' => ['FR', 'fr'];
        yield 'padded' => ['  pt  ', 'pt'];
        yield 'unsupported falls back' => ['de', 'en'];
        yield 'nonsense falls back' => ['not-a-locale', 'en'];
        yield 'empty falls back' => ['', 'en'];
    }

    /** @param list<string> $tags */
    #[Test]
    #[DataProvider('devices')]
    public function aScreensDatesTakeTheDevicesRegionOnlyInTheShownLanguage(string $shown, array $tags, string $expected): void
    {
        self::assertSame($expected, SupportedLocales::formatting($shown, $tags));
    }

    /** @return iterable<string, array{string, list<string>, string}> */
    public static function devices(): iterable
    {
        yield 'en-US on English' => ['en', ['en-US'], 'en-US'];
        yield 'en-GB on English' => ['en', ['en-GB'], 'en-GB'];
        yield 'underscored' => ['pt', ['pt_BR'], 'pt-BR'];
        yield 'lowercase region' => ['es', ['es-mx'], 'es-MX'];
        yield 'numeric region' => ['es', ['es-419'], 'es-419'];
        yield 'with a script' => ['pt', ['pt-Latn-PT'], 'pt-PT'];
        yield 'no region' => ['fr', ['fr'], 'fr'];
        yield 'another language' => ['en', ['fr-FR'], 'en'];
        yield 'the first in the shown language' => ['fr', ['en-US', 'fr-CA', 'fr-FR'], 'fr-CA'];
        yield 'no device' => ['en', [], 'en'];
        yield 'malformed' => ['en', ['en-not a region'], 'en'];
    }

    #[Test]
    public function aRegionWritesItsOwnDateOrderAndBareEnglishStaysBritish(): void
    {
        self::assertSame('en_GB', SupportedLocales::dates('en'));
        self::assertSame('en_US', SupportedLocales::dates('en-US'));
        self::assertSame('pt_PT', SupportedLocales::dates('pt-PT'));
        self::assertSame('fr', SupportedLocales::dates('fr'));
    }

    /**
     * A Brazilian reader should get Portuguese rather than English. Matching on
     * the exact tag rather than the language is how that goes wrong.
     */
    #[Test]
    public function aRegionalVariantIsSupportedThroughItsLanguage(): void
    {
        self::assertTrue(SupportedLocales::supports('pt-BR'));
        self::assertSame('pt', SupportedLocales::narrow('pt-BR'));
    }

    #[Test]
    public function anUnsupportedLocaleIsNeverSelected(): void
    {
        foreach (['de', 'ja', 'ar', 'zh-Hans', 'xx'] as $locale) {
            self::assertFalse(SupportedLocales::supports($locale), $locale);
            self::assertContains(SupportedLocales::narrow($locale), SupportedLocales::ALL);
        }
    }
}
