<?php

declare(strict_types=1);

namespace App\Locale;

final class SupportedLocales
{
    public const DEFAULT = 'en';

    /** @var list<string> */
    public const ALL = ['en', 'es', 'fr', 'pt'];

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
        $language = strtolower(explode('-', str_replace('_', '-', trim($locale)))[0]);

        return $language;
    }
}
