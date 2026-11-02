<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Locale\RecipientLocale;
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

    /**
     * The rule this whole class exists for: an organiser working in English who
     * invites a Portuguese-speaking guest produces a Portuguese invitation.
     */
    #[Test]
    public function anOutboundMessageFollowsTheRecipientNotTheSender(): void
    {
        self::assertSame('pt', RecipientLocale::resolve(recipientPreference: 'pt', eventDefault: 'en'));
    }

    #[Test]
    public function itFallsBackToTheEventLanguageWhenTheGuestHasNoPreference(): void
    {
        self::assertSame('fr', RecipientLocale::resolve(recipientPreference: null, eventDefault: 'fr'));
    }

    #[Test]
    public function itFallsBackToEnglishWhenNeitherIsKnown(): void
    {
        self::assertSame('en', RecipientLocale::resolve(null, null));
    }

    #[Test]
    public function anUnsupportedRecipientPreferenceDoesNotWin(): void
    {
        self::assertSame('es', RecipientLocale::resolve(recipientPreference: 'de', eventDefault: 'es'));
    }
}
