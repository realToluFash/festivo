<?php

declare(strict_types=1);

namespace App\Locale;

use Normalizer;
use Psl\Regex;
use Psl\Str;

/** What makes two names one: case and accents do not count, so "Terrasse" and "TERRASSÉ" clash (sc-3998), and "Adaézé" is already on a list holding "ADAEZE" (sc-1468). */
final class NameNormaliser
{
    /** As typed, trimmed, with each run of whitespace one space. */
    public static function name(string $typed): string
    {
        return Str\trim(Regex\replace($typed, '/\s+/u', ' '));
    }

    public static function key(string $name): string
    {
        $decomposed = \normalizer_normalize(self::name($name), Normalizer::FORM_KD);

        return Str\lowercase(Regex\replace(false === $decomposed ? self::name($name) : $decomposed, '/\p{Mn}+/u', ''));
    }

    /** A label's, a group's or a saved audience's: the curl of an apostrophe aside too, as the web compares them before sending. */
    public static function labelKey(string $name): string
    {
        return self::key(Str\replace_every($name, ['’' => "'", '‘' => "'", '`' => "'"]));
    }
}
