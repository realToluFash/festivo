<?php

declare(strict_types=1);

namespace App\Domain\Organisation;

use DateTimeZone;
use NumberFormatter;
use Psl\Iter;
use Psl\Regex;
use ResourceBundle;

/** Countries, currencies and timezones as ICU knows them, so the API and its data agree with the platform. */
final class Regions
{
    /** ICU region codes that are not countries anybody lives in. */
    private const array NOT_COUNTRIES = ['EU', 'EZ', 'QO', 'UN', 'ZZ'];

    public static function isCountry(string $code): bool
    {
        return Regex\matches($code, '/^[A-Z]{2}$/')
            && !Iter\contains(self::NOT_COUNTRIES, $code)
            && Iter\contains_key(self::table('ICUDATA-region', 'Countries'), $code);
    }

    /** The currency a country uses today, which is what a new organisation starts with. */
    public static function currencyOf(string $country): string
    {
        $formatter = new NumberFormatter('en_' . $country, NumberFormatter::CURRENCY);

        return (string) $formatter->getTextAttribute(NumberFormatter::CURRENCY_CODE);
    }

    public static function isCurrency(string $code): bool
    {
        return Regex\matches($code, '/^[A-Z]{3}$/')
            && Iter\contains_key(self::table('ICUDATA-curr', 'Currencies'), $code);
    }

    public static function isTimezone(string $identifier): bool
    {
        return Iter\contains(DateTimeZone::listIdentifiers(), $identifier);
    }

    /** @return array<array-key, mixed> */
    private static function table(string $bundle, string $key): array
    {
        $table = ResourceBundle::create('en', $bundle)?->get($key);

        return $table instanceof ResourceBundle ? \iterator_to_array($table) : [];
    }
}
