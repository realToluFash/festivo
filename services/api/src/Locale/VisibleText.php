<?php

declare(strict_types=1);

namespace App\Locale;

use Psl\Str;
use Psl\Str\Grapheme;

/** A limit a person reads as "N characters" counts what they see, extended grapheme clusters (sc-54292), so "Ẹ̀gbẹ́" is five, composed or decomposed. */
final class VisibleText
{
    /** Code points a visible character may take before marks stacked without end stop passing as a few letters. */
    private const int CODE_POINTS_EACH = 4;

    public static function length(string $text): int
    {
        return Grapheme\length($text);
    }

    public static function tooLong(string $text, int $maximum): bool
    {
        return self::length($text) > $maximum || Str\length($text) > self::codePoints($maximum);
    }

    /** What a column holds for a limit of $maximum visible characters. */
    public static function codePoints(int $maximum): int
    {
        return $maximum * self::CODE_POINTS_EACH;
    }
}
