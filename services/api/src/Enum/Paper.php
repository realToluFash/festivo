<?php

declare(strict_types=1);

namespace App\Enum;

use Psl\Iter;
use Psl\Str;

/** The paper a made PDF is laid out on (sc-3911): Letter where CLDR's paperSize data says so, A4 everywhere else. */
enum Paper: string
{
    case A4 = 'a4';
    case Letter = 'letter';

    /** CLDR supplementalData paperSize, type "US-Letter". */
    private const array LETTER_COUNTRIES = ['BZ', 'CA', 'CL', 'CO', 'CR', 'GT', 'MX', 'NI', 'PA', 'PH', 'PR', 'SV', 'US', 'VE'];

    public static function forCountry(string $countryCode): self
    {
        return Iter\contains(self::LETTER_COUNTRIES, Str\uppercase($countryCode)) ? self::Letter : self::A4;
    }

    /** The CSS `@page` size. */
    public function pageSize(): string
    {
        return match ($this) {
            self::A4 => 'A4',
            self::Letter => 'letter',
        };
    }
}
