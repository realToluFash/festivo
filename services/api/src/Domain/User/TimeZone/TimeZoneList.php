<?php

declare(strict_types=1);

namespace App\Domain\User\TimeZone;

use DateTimeImmutable;
use DateTimeZone;
use Locale;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;

/** Every IANA zone, one row each, labelled by its own city with today's offset, so both clients list the same. */
final class TimeZoneList
{
    /** @return list<array{id: string, city: string, country: string, offset: string}> */
    public static function at(DateTimeImmutable $now, string $locale): array
    {
        return Vec\map(DateTimeZone::listIdentifiers(), static function (string $id) use ($now, $locale): array {
            $zone = new DateTimeZone($id);
            $code = $zone->getLocation()['country_code'] ?? '??';
            $parts = Str\split($id, '/');

            return [
                'id' => $id,
                'city' => Str\replace(Iter\last($parts) ?? $id, '_', ' '),
                'country' => '??' === $code ? '' : (Locale::getDisplayRegion('-' . $code, $locale) ?: $code),
                'offset' => $now->setTimezone($zone)->format('P'),
            ];
        });
    }
}
