<?php

declare(strict_types=1);

namespace App\Deletion;

use Normalizer;
use Psl\Str;

/** Smart Punctuation types the curly quotes, so only those fold; nothing else that merely looks alike does. */
final class TypedName
{
    private const array QUOTES = ['‘' => "'", '’' => "'", '“' => '"', '”' => '"'];

    public static function matches(string $typed, string $name): bool
    {
        return self::canonical($typed) === self::canonical($name);
    }

    private static function canonical(string $value): string
    {
        $trimmed = Str\trim($value);
        $normalised = \normalizer_normalize($trimmed, Normalizer::FORM_C);

        return \strtr(false === $normalised ? $trimmed : $normalised, self::QUOTES);
    }
}
