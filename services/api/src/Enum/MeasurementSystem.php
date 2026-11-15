<?php

declare(strict_types=1);

namespace App\Enum;

use MessageFormatter;
use Psl\Iter;
use Psl\Math;
use Psl\Str;

/** How a room's sizes are written for an organisation, from its country (sc-3998, 20 Oct): feet and inches where CLDR's measurementSystem is US, metres elsewhere. */
enum MeasurementSystem: string
{
    case Metric = 'metric';
    case UsCustomary = 'us';

    /** CLDR supplemental measurementData, `<measurementSystem type="US">`. */
    private const array US_TERRITORIES = ['LR', 'MM', 'US'];

    public static function forTerritory(string $countryCode): self
    {
        return Iter\contains(self::US_TERRITORIES, Str\uppercase($countryCode)) ? self::UsCustomary : self::Metric;
    }

    /** "2 m" or "6 ft 7 in" in the reader's language, as CLDR words the units and the clients' Intl does: no grouping, so the field reads it back. */
    public function written(int $centimetres, string $locale): string
    {
        if (self::Metric === $this) {
            return self::unit($locale, 'meter', $centimetres / 100);
        }

        return self::feetAndInches((int) Math\round($centimetres / 2.54), $locale);
    }

    /**
     * A range's two ends, each the nearest whole unit inside it (sc-4000): "40 cm" and "10 m", or "1 ft 4 in" and "32 ft 9 in".
     *
     * @return array{0: string, 1: string}
     */
    public function writtenWithin(int $lowestCm, int $highestCm, string $locale): array
    {
        if (self::Metric === $this) {
            return [self::metricSize($lowestCm, $locale), self::metricSize($highestCm, $locale)];
        }

        return [
            self::feetAndInches((int) Math\ceil($lowestCm / 2.54), $locale),
            self::feetAndInches((int) Math\floor($highestCm / 2.54), $locale),
        ];
    }

    private static function metricSize(int $centimetres, string $locale): string
    {
        return 0 === $centimetres % 100 ? self::unit($locale, 'meter', Math\div($centimetres, 100)) : self::unit($locale, 'centimeter', $centimetres);
    }

    private static function feetAndInches(int $inches, string $locale): string
    {
        $feet = self::unit($locale, 'foot', Math\div($inches, 12));
        $left = $inches % 12;

        return 0 === $left ? $feet : Str\format('%s %s', $feet, self::unit($locale, 'inch', $left));
    }

    private static function unit(string $locale, string $unit, float|int $value): string
    {
        $written = MessageFormatter::formatMessage(
            $locale,
            Str\format('{value, number, :: measure-unit/length-%s unit-width-short group-off .##}', $unit),
            ['value' => $value],
        );

        return false === $written ? Str\format('%s %s', (string) $value, $unit) : $written;
    }
}
