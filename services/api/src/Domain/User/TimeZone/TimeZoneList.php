<?php

declare(strict_types=1);

namespace App\Domain\User\TimeZone;

use DateTimeImmutable;
use DateTimeZone;
use IntlTimeZone;
use Locale;
use Psl\Dict;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use ResourceBundle;

/** Every IANA zone, one row each, labelled by its own city with today's offset, so both clients list the same. */
final class TimeZoneList
{
    /**
     * CLDR's city in the reader's language (sc-986); `formerNames` are tzdata's `backward` links, less its own city.
     *
     * @return list<array{id: string, city: string, ianaCity: string, formerNames: list<string>, country: string, offset: string}>
     */
    public static function at(DateTimeImmutable $now, string $locale): array
    {
        $formers = self::formerNames();
        $cities = [self::exemplarCities($locale), self::exemplarCities('root')];

        return Vec\map(DateTimeZone::listIdentifiers(), static function (string $id) use ($now, $locale, $formers, $cities): array {
            $zone = new DateTimeZone($id);
            $code = $zone->getLocation()['country_code'] ?? '??';
            $ianaCity = self::cityOf($id);
            // ICU keys its names by CLDR's own id for a zone, which may be the older name (Asia/Calcutta).
            $key = Str\replace(IntlTimeZone::getCanonicalID($id) ?: $id, '/', ':');

            return [
                'id' => $id,
                'city' => $cities[0][$key] ?? $cities[1][$key] ?? $ianaCity,
                'ianaCity' => $ianaCity,
                'formerNames' => Vec\values(Vec\filter($formers[$id] ?? [], static fn (string $former): bool => $former !== $ianaCity)),
                'country' => '??' === $code ? '' : (Locale::getDisplayRegion('-' . $code, $locale) ?: $code),
                'offset' => $now->setTimezone($zone)->format('P'),
            ];
        });
    }

    private static function cityOf(string $id): string
    {
        return Str\replace(Iter\last(Str\split($id, '/')) ?? $id, '_', ' ');
    }

    /** @return array<string, list<string>> by the zone each `backward` link now names */
    private static function formerNames(): array
    {
        $current = Dict\flip(DateTimeZone::listIdentifiers());
        $formers = [];

        foreach (DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC) as $link) {
            $target = IntlTimeZone::getIanaID($link) ?: null;

            if (isset($current[$link]) || null === $target || !isset($current[$target])) {
                continue;
            }

            $known = $formers[$target] ?? [];
            $name = self::cityOf($link);
            $formers[$target] = Iter\contains($known, $name) ? $known : [...$known, $name];
        }

        return $formers;
    }

    /** @return array<string, string> CLDR's exemplar city by ICU's zone key, for exactly this locale */
    private static function exemplarCities(string $locale): array
    {
        $names = ResourceBundle::create($locale, 'ICUDATA-zone', false)?->get('zoneStrings');
        $cities = [];

        if (!$names instanceof ResourceBundle) {
            return $cities;
        }

        foreach ($names as $key => $strings) {
            $city = $strings instanceof ResourceBundle ? $strings->get('ec') : null;

            if (\is_string($key) && \is_string($city)) {
                $cities[$key] = $city;
            }
        }

        return $cities;
    }
}
