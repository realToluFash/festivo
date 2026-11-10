<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use Normalizer;
use Psl\Regex;
use Psl\Str;

/** What makes two section names one: case and accents do not count (sc-3998), so "Terrasse" and "TERRASSÉ" clash. */
final class SectionNameNormaliser
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
}
