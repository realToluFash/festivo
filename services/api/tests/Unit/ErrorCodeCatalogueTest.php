<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\ErrorCode;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * The guard that makes the registry worth having.
 *
 * A code with no message in a locale renders as its own key path to whoever is
 * reading that language — and nothing else fails. No exception, no log line,
 * no failing request. Just "errors.not_found" on a guest's screen.
 */
final class ErrorCodeCatalogueTest extends TestCase
{
    private const LOCALES = ['en', 'es', 'fr', 'pt'];

    #[Test]
    #[DataProvider('locales')]
    public function everyCodeHasAMessageInEveryLocale(string $locale): void
    {
        $catalogue = self::catalogue($locale);

        $missing = [];
        foreach (ErrorCode::cases() as $case) {
            if (!isset($catalogue[$case->value]) || '' === trim($catalogue[$case->value])) {
                $missing[] = $case->value;
            }
        }

        self::assertSame([], $missing, "Missing in {$locale}: " . implode(', ', $missing));
    }

    #[Test]
    #[DataProvider('locales')]
    public function noLocaleCarriesAMessageForACodeThatNoLongerExists(string $locale): void
    {
        $known = array_map(static fn (ErrorCode $c): string => $c->value, ErrorCode::cases());
        $orphans = array_diff(array_keys(self::catalogue($locale)), $known);

        self::assertSame([], array_values($orphans), "Orphaned in {$locale}: " . implode(', ', $orphans));
    }

    #[Test]
    public function everyLocaleHasTheSameKeys(): void
    {
        $reference = array_keys(self::catalogue('en'));
        sort($reference);

        foreach (self::LOCALES as $locale) {
            $keys = array_keys(self::catalogue($locale));
            sort($keys);
            self::assertSame($reference, $keys, "Key set differs in {$locale}");
        }
    }

    /**
     * A message that is still the English one in another locale is almost
     * always a key that was copied and never translated.
     */
    #[Test]
    public function translationsAreNotLeftAsEnglish(): void
    {
        $english = self::catalogue('en');

        foreach (['es', 'fr', 'pt'] as $locale) {
            foreach (self::catalogue($locale) as $key => $message) {
                self::assertNotSame(
                    $english[$key] ?? null,
                    $message,
                    "{$locale}.{$key} is still the English string",
                );
            }
        }
    }

    #[Test]
    public function everyCodeMapsToASensibleStatus(): void
    {
        foreach (ErrorCode::cases() as $case) {
            self::assertGreaterThanOrEqual(400, $case->status(), $case->value);
            self::assertLessThan(600, $case->status(), $case->value);
        }
    }

    #[Test]
    public function codesAreSnakeCase(): void
    {
        foreach (ErrorCode::cases() as $case) {
            self::assertMatchesRegularExpression('/^[a-z][a-z0-9_]*$/', $case->value);
        }
    }

    /** @return iterable<array{string}> */
    public static function locales(): iterable
    {
        foreach (self::LOCALES as $locale) {
            yield $locale => [$locale];
        }
    }

    /** @return array<string, string> */
    private static function catalogue(string $locale): array
    {
        $path = \dirname(__DIR__, 2) . "/translations/errors.{$locale}.json";
        self::assertFileExists($path, "No catalogue for {$locale}");

        return json_decode((string) file_get_contents($path), true, 512, \JSON_THROW_ON_ERROR);
    }
}
