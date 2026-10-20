<?php

declare(strict_types=1);

namespace App\Domain\User\TimeZone;

use DateTimeImmutable;
use DateTimeZone;
use IntlTimeZone;
use Locale;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use ResourceBundle;

/** Every IANA zone, one row each, labelled by its own city with today's offset, so both clients list the same. */
final class TimeZoneList
{
    /**
     * CLDR's city in the reader's language (sc-986). `aliases` are tzdata's `backward` links, which search finds; only
     * `formerName`, CLDR's own key for the zone, is a name the city once had (sc-1562).
     *
     * @return list<array{id: string, city: string, ianaCity: string, aliases: list<string>, formerName: string|null, country: string, offset: string}>
     */
    public static function at(DateTimeImmutable $now, string $locale): array
    {
        $aliases = self::aliases();
        $cities = [self::exemplarCities($locale), self::exemplarCities('root')];

        return Vec\map(DateTimeZone::listIdentifiers(), static function (string $id) use ($now, $locale, $aliases, $cities): array {
            $zone = new DateTimeZone($id);
            $code = $zone->getLocation()['country_code'] ?? '??';
            $ianaCity = self::cityOf($id);
            // CLDR keeps a zone's id when IANA renames it, so its key is the older name (Asia/Calcutta).
            $cldr = IntlTimeZone::getCanonicalID($id) ?: $id;
            $key = Str\replace($cldr, '/', ':');
            $former = self::cityOf($cldr);

            return [
                'id' => $id,
                'city' => $cities[0][$key] ?? $cities[1][$key] ?? $ianaCity,
                'ianaCity' => $ianaCity,
                'aliases' => Vec\values(Vec\filter($aliases[$id] ?? [], static fn (string $alias): bool => $alias !== $ianaCity)),
                'formerName' => $former === $ianaCity ? null : $former,
                'country' => '??' === $code ? '' : (Locale::getDisplayRegion('-' . $code, $locale) ?: $code),
                'offset' => $now->setTimezone($zone)->format('P'),
            ];
        });
    }

    private static function cityOf(string $id): string
    {
        return Str\replace(Iter\last(Str\split($id, '/')) ?? $id, '_', ' ');
    }

    /** @var array<string, list<string>>|null tzdata's, so the same for every request this process answers */
    private static ?array $aliases = null;

    /** @return array<string, list<string>> by the zone each `backward` link now names, resolved as a PUT resolves it */
    private static function aliases(): array
    {
        if (null !== self::$aliases) {
            return self::$aliases;
        }

        $aliases = [];

        foreach (DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC) as $link) {
            $target = AccountTimeZone::canonical($link);

            if (null === $target || $target === $link) {
                continue;
            }

            $known = $aliases[$target] ?? [];
            $name = self::cityOf($link);
            $aliases[$target] = Iter\contains($known, $name) ? $known : [...$known, $name];
        }

        return self::$aliases = $aliases;
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
