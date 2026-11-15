<?php

declare(strict_types=1);

namespace App\Address;

use App\Address\Model\Address;
use DateTimeZone;
use Psl\Iter;
use Psl\Math;
use Psl\Str;

/** The zone of the address's country whose principal city lies nearest it; exact for a country with one zone, the best guess for the rest. */
final class AddressTimeZone
{
    public static function of(Address $address): ?string
    {
        $country = Str\uppercase($address->countryCode ?? '');

        if ('' === $country) {
            return null;
        }

        $zones = DateTimeZone::listIdentifiers(DateTimeZone::PER_COUNTRY, $country);

        if ([] === $zones) {
            return null;
        }

        if (1 === Iter\count($zones)) {
            return $zones[0];
        }

        if (null === $address->latitude || null === $address->longitude) {
            return null;
        }

        $nearest = null;
        $shortest = \INF;

        foreach ($zones as $zone) {
            $location = new DateTimeZone($zone)->getLocation();

            if (false === $location) {
                continue;
            }

            $distance = self::distance($address->latitude, $address->longitude, $location['latitude'], $location['longitude']);

            if ($distance < $shortest) {
                $shortest = $distance;
                $nearest = $zone;
            }
        }

        return $nearest;
    }

    private static function distance(float $fromLatitude, float $fromLongitude, float $toLatitude, float $toLongitude): float
    {
        $radians = Math\PI / 180;
        $a = Math\sin(($toLatitude - $fromLatitude) * $radians / 2) ** 2
            + Math\cos($fromLatitude * $radians) * Math\cos($toLatitude * $radians) * Math\sin(($toLongitude - $fromLongitude) * $radians / 2) ** 2;

        return 2 * Math\asin(Math\minva(1.0, Math\sqrt($a)));
    }
}
