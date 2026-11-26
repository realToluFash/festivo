<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Locale\LocaleNumbers;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Translation\Translator;

/** The API writes a number as the clients' Intl does, so a refusal and the screen beside it agree (sc-3917). */
final class LocaleNumbersTest extends TestCase
{
    /** @return iterable<string, array{string, int|float, non-negative-int, string}> */
    public static function written(): iterable
    {
        yield 'en groups four digits' => ['en', 2000, 0, '2,000'];
        yield 'fr groups four digits' => ['fr', 2000, 0, "2\u{202F}000"];
        yield 'es leaves four digits ungrouped' => ['es', 2000, 0, '2000'];
        yield 'es groups five' => ['es', 20000, 0, '20.000'];
        yield 'pt is Portugal’s, four digits ungrouped' => ['pt', 2000, 0, '2000'];
        yield 'pt groups five with a space' => ['pt', 20000, 0, "20\u{A0}000"];
        yield 'en with two decimals' => ['en', 12.5, 2, '12.50'];
        yield 'fr with two decimals' => ['fr', 12.5, 2, '12,50'];
        yield 'es with three decimals' => ['es', 1234.5, 3, '1234,500'];
    }

    /** @param non-negative-int $digits */
    #[Test]
    #[DataProvider('written')]
    public function aNumberIsWrittenAsTheClientsWriteIt(string $locale, int|float $number, int $digits, string $expected): void
    {
        self::assertSame($expected, new LocaleNumbers(new Translator($locale))->decimal($number, $digits));
    }
}
