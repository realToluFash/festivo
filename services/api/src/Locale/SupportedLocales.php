<?php

declare(strict_types=1);

namespace App\Locale;

use Psl\Iter;
use Psl\Regex;
use Psl\Str;
use Psl\Vec;

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

    /** Bare `en` is ICU's US order; the house English is en-GB (docs/i18n/en.md). A tag with a region keeps it. */
    public static function dates(string $locale): string
    {
        $tag = Str\replace($locale, '-', '_');

        return 'en' === $tag ? 'en_GB' : $tag;
    }

    /**
     * The client's `formattingLocale` (sc-8421): the first tag in the shown language, with its region, else the language alone.
     *
     * @param list<string> $tags
     */
    public static function formatting(string $shown, array $tags): string
    {
        $tag = Iter\first(Vec\filter($tags, static fn (string $tag): bool => self::normalise($tag) === $shown));
        $matched = null === $tag ? null : Regex\first_match(Str\replace(Str\trim($tag), '_', '-'), '/^[a-z]{2,3}(?:-[a-z]{4})?-([a-z]{2}|\d{3})$/i');

        return null === $matched ? $shown : $shown . '-' . Str\uppercase($matched[1]);
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
        return Str\lowercase(Str\split(Str\replace(Str\trim($locale), '_', '-'), '-')[0]);
    }
}
