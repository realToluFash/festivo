<?php

declare(strict_types=1);

namespace App\Http;

use Psl\Iter;
use Psl\Str;
use Psl\Vec;

/** A strong ETag from a row's version, and the If-Match test against it (RFC 9110 §8.8.3, §13.1.1). */
final class EntityTag
{
    public static function of(int $version): string
    {
        return '"' . $version . '"';
    }

    /** Strong comparison, so a weak tag never matches. */
    public static function matches(string $ifMatch, string $current): bool
    {
        $tags = Vec\map(Str\split($ifMatch, ','), Str\trim(...));

        return '*' === Str\trim($ifMatch) || Iter\contains($tags, $current);
    }
}
