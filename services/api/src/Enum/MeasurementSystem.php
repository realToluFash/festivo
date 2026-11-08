<?php

declare(strict_types=1);

namespace App\Enum;

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

    /** The English fallback a refusal carries, "2 m" or "6 ft 7 in", rounded to whole inches; the clients word their own. */
    public function written(int $centimetres): string
    {
        if (self::Metric === $this) {
            return Str\format('%s m', (string) ($centimetres / 100));
        }

        $inches = (int) Math\round($centimetres / 2.54);
        $feet = Math\div($inches, 12);
        $left = $inches % 12;

        return 0 === $left ? Str\format('%d ft', $feet) : Str\format('%d ft %d in', $feet, $left);
    }
}
