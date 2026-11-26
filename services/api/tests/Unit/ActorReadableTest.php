<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\Actor;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class ActorReadableTest extends TestCase
{
    private const LOCALES = ['en', 'es', 'fr', 'pt'];

    #[Test]
    public function everyCaseReadsAsAKeyDerivedFromItsStoredValue(): void
    {
        foreach (Actor::cases() as $case) {
            self::assertSame('actor.' . $case->value, $case->getReadable());
        }
    }

    #[Test]
    #[DataProvider('locales')]
    public function everyCaseHasALabelInEveryLocale(string $locale): void
    {
        $catalogue = self::catalogue($locale);

        $missing = [];
        foreach (Actor::cases() as $case) {
            $key = $case->getReadable();
            if (!isset($catalogue[$key]) || '' === \trim($catalogue[$key])) {
                $missing[] = $key;
            }
        }

        self::assertSame([], $missing, "Missing in {$locale}: " . \implode(', ', $missing));
    }

    #[Test]
    #[DataProvider('locales')]
    public function noLocaleCarriesALabelForACaseThatNoLongerExists(string $locale): void
    {
        $known = \array_map(static fn (Actor $c): string => $c->getReadable(), Actor::cases());
        $actorKeys = \array_filter(
            \array_keys(self::catalogue($locale)),
            static fn (string $k): bool => \str_starts_with($k, 'actor.'),
        );

        self::assertSame([], \array_values(\array_diff($actorKeys, $known)));
    }

    #[Test]
    public function noTwoCasesShareALabelInAnyLocale(): void
    {
        foreach (self::LOCALES as $locale) {
            $catalogue = self::catalogue($locale);
            $labels = \array_map(static fn (Actor $c): string => $catalogue[$c->getReadable()], Actor::cases());

            self::assertSame(
                \count($labels),
                \count(\array_unique($labels)),
                "Two actors read the same in {$locale}: " . \implode(', ', $labels),
            );
        }
    }

    public static function locales(): iterable
    {
        foreach (self::LOCALES as $locale) {
            yield $locale => [$locale];
        }
    }

    /** @return array<string, string> */
    private static function catalogue(string $locale): array
    {
        $path = \dirname(__DIR__, 2) . "/translations/messages.{$locale}.json";
        self::assertFileExists($path);

        return \json_decode((string) \file_get_contents($path), true, 512, \JSON_THROW_ON_ERROR);
    }
}
