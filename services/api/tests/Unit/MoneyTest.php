<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Locale\Money;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Translation\Translator;

/** An amount at its currency's ISO 4217 minor unit, shared by the menu's prices and the budget's lines (sc-68066). */
final class MoneyTest extends TestCase
{
    /** @return iterable<string, array{string, string, int}> */
    public static function read(): iterable
    {
        yield 'euros and cents' => ['12.50', 'EUR', 1250];
        yield 'one decimal' => ['12.5', 'EUR', 1250];
        yield 'whole euros' => ['4500', 'EUR', 450_000];
        yield 'yen' => ['4500', 'JPY', 4500];
        yield 'dinars' => ['12.5', 'KWD', 12_500];
        yield 'fifteen digits' => ['999999999999999', 'JPY', 999_999_999_999_999];
    }

    #[Test]
    #[DataProvider('read')]
    public function anAmountIsReadAtItsMinorUnit(string $amount, string $currency, int $minor): void
    {
        self::assertSame($minor, Money::minorOf($amount, $currency));
    }

    /** @return iterable<string, array{string, string}> */
    public static function refused(): iterable
    {
        yield 'a cent too fine' => ['12.505', 'EUR'];
        yield 'a decimal yen' => ['4500.5', 'JPY'];
        yield 'a comma' => ['12,50', 'EUR'];
        yield 'negative' => ['-3', 'EUR'];
        yield 'an exponent' => ['1e3', 'EUR'];
        yield 'a trailing point' => ['12.', 'EUR'];
        yield 'a leading point' => ['.5', 'EUR'];
        yield 'sixteen digits' => ['1234567890123456', 'EUR'];
    }

    #[Test]
    #[DataProvider('refused')]
    public function anAmountItCannotHoldIsRefusedNeverRounded(string $amount, string $currency): void
    {
        self::assertNull(Money::minorOf($amount, $currency));
    }

    #[Test]
    public function anAmountIsWrittenWithItsCurrencysDecimals(): void
    {
        self::assertSame('12.50', Money::written(1250, 'EUR'));
        self::assertSame('4500.00', Money::written(450_000, 'EUR'));
        self::assertSame('0.05', Money::written(5, 'EUR'));
        self::assertSame('4500', Money::written(4500, 'JPY'));
        self::assertSame('12.500', Money::written(12_500, 'KWD'));
    }

    #[Test]
    public function theExampleFollowsTheReadersLocaleAndTheCurrency(): void
    {
        self::assertSame('12.50', new Money(new Translator('en'))->example('EUR'));
        self::assertSame('12,50', new Money(new Translator('fr'))->example('EUR'));
        self::assertSame('12', new Money(new Translator('en'))->example('JPY'));
        self::assertSame('12.500', new Money(new Translator('en'))->example('KWD'));
    }
}
