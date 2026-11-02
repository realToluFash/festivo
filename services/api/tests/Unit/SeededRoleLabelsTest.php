<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Organisation\Roles\SeededRoleLabels;
use App\Enum\SeededRole;
use App\Locale\SupportedLocales;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Translation\Loader\ArrayLoader;
use Symfony\Component\Translation\Loader\JsonFileLoader;
use Symfony\Component\Translation\Translator;

final class SeededRoleLabelsTest extends TestCase
{
    #[Test]
    #[DataProvider('locales')]
    public function everySeededRoleHasItsOwnLabelInEveryLanguage(string $locale): void
    {
        $labels = Vec\map(SeededRole::cases(), static fn (SeededRole $seeded): string => self::labels()->label($seeded, $locale));

        self::assertSame([], Vec\filter($labels, static fn (string $label): bool => Str\starts_with($label, 'seeded_role.')), "untranslated in {$locale}");
        self::assertCount(Iter\count(SeededRole::cases()), Dict\unique($labels), "two seeded roles read the same in {$locale}");
    }

    #[Test]
    #[DataProvider('locales')]
    public function noLanguageLabelsASeededRoleThatNoLongerExists(string $locale): void
    {
        $catalogue = Type\dict(Type\string(), Type\string())->coerce(Json\decode((string) \file_get_contents(self::catalogue($locale))));
        $known = Vec\map(SeededRole::cases(), static fn (SeededRole $seeded): string => $seeded->getReadable());
        $labelled = Vec\filter(Vec\keys($catalogue), static fn (string $key): bool => Str\starts_with($key, 'seeded_role.'));

        self::assertSame([], Vec\values(Vec\filter($labelled, static fn (string $key): bool => !Iter\contains($known, $key))));
    }

    #[Test]
    #[DataProvider('names')]
    public function aNameIsASeededLabelInAnyLanguageIgnoringOnlyCase(string $name, bool $seeded): void
    {
        self::assertSame($seeded, self::labels()->includes($name));
    }

    /** @return iterable<string, array{string, bool}> */
    public static function names(): iterable
    {
        yield 'Spanish' => ['Coordinador', true];
        yield 'French, in capitals' => ['COORDINATEUR', true];
        yield 'Portuguese, in lower case' => ['só leitura', true];
        yield 'English' => ['event manager', true];
        yield 'without the accent' => ['Proprietario', false];
        yield 'plural' => ['Coordinators', false];
        yield 'a name of its own' => ['Door team', false];
    }

    #[Test]
    public function aLabelALinguistChangesIsCheckedAsChanged(): void
    {
        $translator = self::translator();
        $translator->addResource('array', ['seeded_role.coordinator' => 'Coordinadora'], 'es', 'messages');
        $labels = new SeededRoleLabels($translator);

        self::assertTrue($labels->includes('coordinadora'));
        self::assertFalse($labels->includes('Coordinador'));
    }

    /** @return iterable<string, array{string}> */
    public static function locales(): iterable
    {
        foreach (SupportedLocales::ALL as $locale) {
            yield $locale => [$locale];
        }
    }

    private static function labels(): SeededRoleLabels
    {
        return new SeededRoleLabels(self::translator());
    }

    private static function translator(): Translator
    {
        $translator = new Translator(SupportedLocales::DEFAULT);
        $translator->addLoader('json', new JsonFileLoader());
        $translator->addLoader('array', new ArrayLoader());

        foreach (SupportedLocales::ALL as $locale) {
            $translator->addResource('json', self::catalogue($locale), $locale, 'messages');
        }

        return $translator;
    }

    private static function catalogue(string $locale): string
    {
        return \dirname(__DIR__, 2) . "/translations/messages.{$locale}.json";
    }
}
