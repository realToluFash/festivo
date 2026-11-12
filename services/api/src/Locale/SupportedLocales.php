<?php

declare(strict_types=1);

namespace App\Locale;

final class SupportedLocales
{
    public const DEFAULT = 'en';

    /** @var list<string> */
    public const ALL = ['en', 'es', 'fr', 'pt'];

    /**
     * The locales whose copy counts by a region's rule, as /locales.json's `plurals` declares.
     *
     * @var array<string, string>
     */
    public const PLURALS = ['pt' => 'pt_PT'];

    public static function plurals(string $locale): string
    {
        return self::PLURALS[$locale] ?? $locale;
    }

    /** Bare `en` is ICU's US order; the house English is en-GB (docs/i18n/en.md). */
    public static function dates(string $locale): string
    {
        return 'en' === $locale ? 'en_GB' : $locale;
    }

    public static function supports(?string $locale): bool
    {
        return null !== $locale && \in_array(self::normalise($locale), self::ALL, true);
    }

    public static function narrow(?string $locale): string
    {
        if (null === $locale) {
            return self::DEFAULT;
        }

        $normalised = self::normalise($locale);

        return \in_array($normalised, self::ALL, true) ? $normalised : self::DEFAULT;
    }

    private static function normalise(string $locale): string
    {
        return \strtolower(\explode('-', \str_replace('_', '-', \trim($locale)))[0]);
    }
}
