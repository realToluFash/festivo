<?php

declare(strict_types=1);

namespace App\Http;

use Psl\Iter;
use Psl\Regex;
use Psl\Str;
use Psl\Vec;

/** A strong ETag from a row's version, and the If-Match test against it (RFC 9110 §8.8.3, §13.1.1). */
final class EntityTag
{
    public static function of(int $version): string
    {
        return '"' . $version . '"';
    }

    /**
     * Strong comparison, so a weak tag never matches. Caddy suffixes a strong tag with the coding it compressed the response in, and strips it only from If-None-Match.
     */
    public static function matches(string $ifMatch, string $current): bool
    {
        $tags = Vec\map(Str\split($ifMatch, ','), static fn (string $tag): string => Regex\replace(Str\trim($tag), '/-(zstd|br|gzip)"$/', '"'));

        return Iter\contains($tags, $current);
    }
}
