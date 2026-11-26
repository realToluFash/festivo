<?php

declare(strict_types=1);

namespace App\Locale;

use MessageFormatter;
use Psl\Str;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A number in the reader's locale (CLDR) for a message to quote, never written into a translation: en 2,000, fr 2 000, es and pt 2000, as the clients write it (sc-92, sc-3917). */
final readonly class LocaleNumbers
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** @param non-negative-int $digits A skeleton, as NumberFormatter drops CLDR's minimum grouping digits and writes es 2.000. */
    public function decimal(int|float $number, int $digits = 0): string
    {
        $precision = 0 === $digits ? 'precision-integer' : '.' . Str\repeat('0', $digits);

        return (string) MessageFormatter::formatMessage(SupportedLocales::plurals($this->translator->getLocale()), '{0,number,::' . $precision . '}', [$number]);
    }
}
