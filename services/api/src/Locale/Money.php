<?php

declare(strict_types=1);

namespace App\Locale;

use NumberFormatter;
use Psl\Math;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Symfony\Contracts\Translation\TranslatorInterface;

/** An amount as the API reads and writes it: a plain decimal at its currency's ISO 4217 minor unit (sc-3901, sc-83). */
final readonly class Money
{
    private const int MOST_WHOLE_DIGITS = 15;

    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** A plain decimal, "4500" or "12.50", with no more decimals than the currency's ISO 4217 minor unit: more is refused, never rounded. */
    public static function minorOf(string $amount, string $currency): ?int
    {
        if (!Regex\matches($amount, '/^\d{1,' . self::MOST_WHOLE_DIGITS . '}(\.\d+)?$/')) {
            return null;
        }

        $digits = self::minorDigits($currency);
        $parts = Str\split($amount, '.');
        $fraction = $parts[1] ?? '';

        if (Str\length($fraction) > $digits) {
            return null;
        }

        return (int) $parts[0] * (int) Math\round(10 ** $digits) + (int) Str\pad_right($fraction, $digits, '0');
    }

    /** @return non-negative-int */
    public static function minorDigits(string $currency): int
    {
        return Type\uint()->coerce(new NumberFormatter('en@currency=' . $currency, NumberFormatter::CURRENCY)->getAttribute(NumberFormatter::FRACTION_DIGITS));
    }

    public static function written(int $minor, string $currency): string
    {
        $digits = self::minorDigits($currency);

        if (0 === $digits) {
            return (string) $minor;
        }

        $scale = (int) Math\round(10 ** $digits);

        return Str\format('%d.%s', Math\div($minor, $scale), Str\pad_left((string) ($minor % $scale), $digits, '0'));
    }

    /** "12.50" in the reader's locale (CLDR), at the currency's minor unit, for a refusal to show. */
    public function example(string $currency): string
    {
        $digits = self::minorDigits($currency);
        $formatter = new NumberFormatter($this->translator->getLocale(), NumberFormatter::DECIMAL);
        $formatter->setAttribute(NumberFormatter::MIN_FRACTION_DIGITS, $digits);
        $formatter->setAttribute(NumberFormatter::MAX_FRACTION_DIGITS, $digits);

        return (string) $formatter->format(0 === $digits ? 12 : 12.5);
    }
}
