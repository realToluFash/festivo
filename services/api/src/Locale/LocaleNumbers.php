<?php

declare(strict_types=1);

namespace App\Locale;

use NumberFormatter;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A number in the reader's locale (CLDR) for a message to quote, never written into a translation: en 2,000, fr 2 000, es and pt 2000 (sc-92, sc-3917). */
final readonly class LocaleNumbers
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** @param non-negative-int $digits */
    public function decimal(int|float $number, int $digits = 0): string
    {
        $formatter = new NumberFormatter($this->translator->getLocale(), NumberFormatter::DECIMAL);
        $formatter->setAttribute(NumberFormatter::MIN_FRACTION_DIGITS, $digits);
        $formatter->setAttribute(NumberFormatter::MAX_FRACTION_DIGITS, $digits);

        return (string) $formatter->format($number);
    }
}
