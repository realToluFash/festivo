<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Budget\BudgetRange;
use App\Domain\Budget\BudgetWhatIf;
use App\Domain\Budget\Model\LineCost;
use App\Domain\Budget\Model\QuantityFacts;
use App\Domain\Budget\Model\WhatIfChanges;
use App\Entity\BudgetLine;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Enum\CostBasis;
use App\Enum\CostCategory;
use App\Enum\EventType;
use App\Locale\Money;
use BcMath\Number;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Type;
use Psl\Vec;

final class BudgetArithmeticTest extends TestCase
{
    private const string LARGEST_GBP = '999999999999999.99';

    #[Test]
    public function aPerHeadLineAtTheLargestRateForAHundredHeadsIsExact(): void
    {
        $event = self::event('GBP');
        $range = BudgetRange::of([self::line($event, CostBasis::PerHead, self::LARGEST_GBP)], self::heads(100));

        self::assertSame(['99999999999999999.00', '99999999999999999.00'], self::lineCost($range->lines[0], 'GBP'));
        self::assertSame(['99999999999999999.00', '99999999999999999.00', '999999999999999.99', '999999999999999.99'], self::figures($range, 'GBP'));
    }

    #[Test]
    public function tenOfTheLargestFixedLinesAddUpExactly(): void
    {
        $event = self::event('KWD');
        $lines = Vec\map(Vec\range(1, 10), static fn (int $_): BudgetLine => self::line($event, CostBasis::Fixed, '999999999999999.999'));

        self::assertSame(['9999999999999999.990', '9999999999999999.990', '3333333333333333.330', '3333333333333333.330'], self::figures(BudgetRange::of($lines, self::heads(3)), 'KWD'));
    }

    #[Test]
    public function perHeadRoundsHalfUpAtAnySize(): void
    {
        $event = self::event('GBP');
        $range = BudgetRange::of([self::line($event, CostBasis::PerHead, self::LARGEST_GBP), self::line($event, CostBasis::Fixed, '0.50')], self::heads(100));

        self::assertSame(['99999999999999999.50', '99999999999999999.50', '1000000000000000.00', '1000000000000000.00'], self::figures($range, 'GBP'));
    }

    /** @return iterable<string, array{CostBasis, QuantityFacts, string}> */
    public static function bases(): iterable
    {
        yield 'per table, 100 tables' => [CostBasis::PerTable, new QuantityFacts(0, 0, 100, null, 1, 0), '99999999999999999.00'];
        yield 'per day, 12 days' => [CostBasis::PerDay, new QuantityFacts(0, 0, null, null, 12, 0), '11999999999999999.88'];
    }

    #[Test]
    public function theStaffTimeLineCostsStaffRatesTotalAtBothEndsWhateverItsHours(): void
    {
        $range = BudgetRange::of([self::line(self::event('GBP'), CostBasis::PerStaffHour, self::LARGEST_GBP)], new QuantityFacts(0, 0, null, 40, 1, 0, 150_200));

        self::assertSame(['1502.00', '1502.00'], self::lineCost($range->lines[0], 'GBP'));
    }

    #[Test]
    #[DataProvider('bases')]
    public function everyBasisCostsExactlyItsRateTimesItsCount(CostBasis $basis, QuantityFacts $facts, string $cost): void
    {
        $range = BudgetRange::of([self::line(self::event('GBP'), $basis, self::LARGEST_GBP)], $facts);

        self::assertSame([$cost, $cost], self::lineCost($range->lines[0], 'GBP'));
    }

    #[Test]
    public function oneMoreGuestOnTheLargestPerHeadLineIsAnsweredExactly(): void
    {
        $answer = BudgetWhatIf::of([self::line(self::event('GBP'), CostBasis::PerHead, self::LARGEST_GBP)], self::heads(100), new WhatIfChanges(1, 0, 0, 0));
        $move = $answer->moves[0];

        self::assertSame('999999999999999.99', Money::written($answer->then->potentialMinor->sub($answer->now->potentialMinor), 'GBP'));
        self::assertSame('0.00', Money::written($answer->then->confirmedMinor->sub($answer->now->confirmedMinor), 'GBP'));
        self::assertSame(['99999999999999999.00', '100999999999999998.99'], [Money::written($move->now->potentialMinor, 'GBP'), Money::written($move->then->potentialMinor, 'GBP')]);
    }

    /** @return iterable<string, array{int|numeric-string, string, string}> */
    public static function writings(): iterable
    {
        yield 'pounds' => [135000, 'GBP', '1350.00'];
        yield 'yen, no decimals' => [4500, 'JPY', '4500'];
        yield 'dinars, three decimals' => [12500, 'KWD', '12.500'];
        yield 'past the largest int, in plain digits' => ['100000000000000000000', 'GBP', '1000000000000000000.00'];
        yield 'a fall of under one unit' => [-50, 'GBP', '-0.50'];
    }

    /** @param int|numeric-string $minor */
    #[Test]
    #[DataProvider('writings')]
    public function moneyIsWrittenInPlainDigitsAtTheCurrencysDecimals(int|string $minor, string $currency, string $written): void
    {
        self::assertSame($written, Money::written(\is_int($minor) ? $minor : new Number($minor), $currency));
    }

    private static function event(string $currency): Event
    {
        $organisation = new Organisation('Bloom Events', 'GB', 'GBP', 'Europe/London', 'hello@bloom.events', 'en');

        return new Event($organisation, 'Summer wedding', EventType::Wedding, new DateTimeImmutable('2027-06-12T13:00:00Z'), new DateTimeImmutable('2027-06-13T00:00:00Z'), $currency);
    }

    private static function line(Event $event, CostBasis $basis, string $price): BudgetLine
    {
        return new BudgetLine($event, 'Line', CostCategory::Catering, $basis, Type\int()->coerce(Money::minorOf($price, $event->getCurrency())), null);
    }

    private static function heads(int $coming): QuantityFacts
    {
        return new QuantityFacts($coming, $coming, null, null, 1, $coming);
    }

    /** @return array{string, string} */
    private static function lineCost(LineCost $cost, string $currency): array
    {
        return [Money::written($cost->confirmedMinor, $currency), Money::written($cost->potentialMinor, $currency)];
    }

    /** @return array{string, string, ?string, ?string} */
    private static function figures(BudgetRange $range, string $currency): array
    {
        $written = static fn (?Number $minor): ?string => null === $minor ? null : Money::written($minor, $currency);

        return [Money::written($range->confirmedMinor, $currency), Money::written($range->potentialMinor, $currency), $written($range->confirmedPerHead()), $written($range->potentialPerHead())];
    }
}
