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

        $inches = (int) Math\round($centimetres / 2.54);
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
