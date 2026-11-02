<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Roles;

use Normalizer;
use Psl\Str;

/** A role name in NFC (sc-2766): composed and decomposed accents are the same name, and only canonical equivalents are folded. */
final class RoleName
{
    public static function of(string $typed): string
    {
        $name = Str\trim($typed);
        $normalised = \normalizer_normalize($name, Normalizer::FORM_C);

        return false === $normalised ? $name : $normalised;
    }

    public static function same(string $a, string $b): bool
    {
        return Str\lowercase(self::of($a)) === Str\lowercase(self::of($b));
    }
}
