<?php

declare(strict_types=1);

namespace App\Locale;

/**
 * The four, in one place.
 *
 * Every resolution path narrows to this list. A locale we have no catalogue for
 * must never be selected: the failure is not an error but a page of raw
 * translation keys, which looks like text and is not.
 */
final class SupportedLocales
{
    public const DEFAULT = 'en';

    /** @var list<string> */
    public const ALL = ['en', 'es', 'fr', 'pt'];

    public static function supports(?string $locale): bool
    {
        return null !== $locale && \in_array(self::normalise($locale), self::ALL, true);
    }

    /**
     * Narrow anything to a supported locale, or to the default.
     *
     * Accepts the forms a client actually sends — `pt-BR`, `fr_FR`, `EN` — and
     * reduces them to the language. A Brazilian reader gets Portuguese rather
     * than English, which is the point of matching on language rather than on
     * the exact tag.
     */
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
        $language = strtolower(explode('-', str_replace('_', '-', trim($locale)))[0]);

        return $language;
    }
}
