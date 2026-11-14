<?php

declare(strict_types=1);

namespace App\Integrations\OpenIdConnect;

use Psl\Str;
use Psl\Vec;

/** A comma-separated environment value, as the non-empty items it lists. */
final class ConfiguredList
{
    /** @return list<non-empty-string> */
    public static function of(string $csv): array
    {
        return Vec\filter_nulls(Vec\map(Str\split($csv, ','), static function (string $item): ?string {
            $item = Str\trim($item);

            return '' === $item ? null : $item;
        }));
    }
}
