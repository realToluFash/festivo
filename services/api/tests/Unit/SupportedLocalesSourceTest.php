<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Locale\SupportedLocales;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Yaml\Yaml;

/**
 * Everything that names a locale must name the same ones.
 *
 * The set is declared in /locales.json, and repeated — necessarily — as a PHP
 * constant on the request path and as `enabled_locales` in Symfony's config.
 * Each of those works perfectly on its own while disagreeing with the others,
 * which is why this is a test rather than a convention.
 *
 * The clients read the same file. When apps/web and apps/mobile land, they get
 * checked here too.
 */
final class SupportedLocalesSourceTest extends TestCase
{
    #[Test]
    public function thePhpConstantMatchesTheDeclaration(): void
    {
        self::assertSame(
            $this->declared(),
            SupportedLocales::ALL,
            'SupportedLocales::ALL has drifted from /locales.json',
        );
    }

    #[Test]
    public function theDefaultMatchesTheDeclaration(): void
    {
        self::assertSame($this->source()['default'], SupportedLocales::DEFAULT);
    }

    #[Test]
    public function theDefaultIsOneOfTheSupportedLocales(): void
    {
        self::assertContains(SupportedLocales::DEFAULT, SupportedLocales::ALL);
    }

    /**
     * Symfony refuses to negotiate into a locale outside `enabled_locales`, so
     * this one disagreeing means a language with a full catalogue that can
     * never be selected.
     */
    #[Test]
    public function symfonysEnabledLocalesMatchesTheDeclaration(): void
    {
        $config = Yaml::parseFile(\dirname(__DIR__, 2) . '/config/packages/translation.yaml');
        $enabled = $config['framework']['enabled_locales'] ?? null;

        self::assertIsArray($enabled, 'translation.yaml declares no enabled_locales');

        $sorted = $enabled;
        sort($sorted);

        self::assertSame($this->declared(), $sorted, 'enabled_locales has drifted from /locales.json');
    }

    /**
     * A catalogue for a locale nobody can select is dead weight; a selectable
     * locale with no catalogue renders raw keys.
     */
    #[Test]
    public function everyDeclaredLocaleHasAtLeastOneCatalogue(): void
    {
        foreach ($this->declared() as $locale) {
            $found = glob(\dirname(__DIR__, 2) . "/translations/*.{$locale}.json") ?: [];
            self::assertNotEmpty($found, "No catalogue at all for declared locale '{$locale}'");
        }
    }

    /** @return list<string> */
    private function declared(): array
    {
        $codes = array_map(
            static fn (array $l): string => $l['code'],
            $this->source()['supported'],
        );
        sort($codes);

        return $codes;
    }

    /** @return array{default: string, supported: list<array{code: string, name: string, nativeName: string, dir: string}>} */
    private function source(): array
    {
        // An explicit path from the environment, not arithmetic on __DIR__.
        // The file lives at the repository root, which is outside the
        // application's own tree — guessing at its depth is how this test
        // starts passing vacuously when something moves.
        $path = $_SERVER['LOCALES_FILE'] ?? getenv('LOCALES_FILE') ?: null;

        self::assertIsString($path, 'LOCALES_FILE is not set — see compose.yaml');
        self::assertFileExists($path, 'The locale declaration is missing');

        return json_decode((string) file_get_contents($path), true, 512, \JSON_THROW_ON_ERROR);
    }
}
