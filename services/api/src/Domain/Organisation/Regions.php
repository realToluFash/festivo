<?php

declare(strict_types=1);

namespace App\Domain\Organisation;

use NumberFormatter;
use Psl\Iter;
use Psl\Regex;
use ResourceBundle;

/** Countries and timezones as ICU knows them; currencies as ISO 4217 lists them in use today. */
final class Regions
{
    /** ICU region codes that are not countries anybody lives in. */
    private const array NOT_COUNTRIES = ['EU', 'EZ', 'QO', 'UN', 'ZZ'];

    /** ISO 4217 List One (SIX, published 2026-09-17): active codes, without funds, metals or the X-codes that are not money. */
    public const array CURRENCIES = [
        'AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT',
        'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD',
        'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP',
        'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
        'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR',
        'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD',
        'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK',
        'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO',
        'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR',
        'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE',
        'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP',
        'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VED', 'VES', 'VND',
        'VUV', 'WST', 'XAF', 'XCD', 'XCG', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG',
    ];

    /** Countries whose currency changed after the ICU the container runs was published. */
    private const array CURRENCY_CHANGES = ['BG' => 'EUR'];

    public static function isCountry(string $code): bool
    {
        return Regex\matches($code, '/^[A-Z]{2}$/')
            && !Iter\contains(self::NOT_COUNTRIES, $code)
            && Iter\contains_key(self::table('ICUDATA-region', 'Countries'), $code);
    }

    /** The currency a country uses today, which is what a new organisation starts with: none for a country with no money of its own. */
    public static function currencyOf(string $country): string
    {
        $code = self::CURRENCY_CHANGES[$country] ?? (string) new NumberFormatter('en_' . $country, NumberFormatter::CURRENCY)
            ->getTextAttribute(NumberFormatter::CURRENCY_CODE);

        return self::isCurrency($code) ? $code : '';
    }

    public static function isCurrency(string $code): bool
    {
        return Iter\contains(self::CURRENCIES, $code);
    }

    /** @return array<array-key, mixed> */
    private static function table(string $bundle, string $key): array
    {
        $table = ResourceBundle::create('en', $bundle)?->get($key);

        return $table instanceof ResourceBundle ? \iterator_to_array($table) : [];
    }
}
