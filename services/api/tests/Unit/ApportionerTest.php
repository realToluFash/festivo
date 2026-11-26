<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Budget\Apportioner;
use BcMath\Number;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Vec;

final class ApportionerTest extends TestCase
{
    /** @return iterable<string, array{int, list<int>, list<int>}> */
    public static function splits(): iterable
    {
        yield '£100.00 at 33.33 / 33.33 / 33.34' => [10000, [3333, 3333, 3334], [3333, 3333, 3334]];
        yield '£1,234.56 at 33.33 / 33.33 / 33.34, each to the nearest penny' => [123456, [3333, 3333, 3334], [41148, 41148, 41160]];
        yield '£0.01 at 50 / 50, to the payer added first' => [1, [5000, 5000], [1, 0]];
        yield '£0.10 at 33.33 / 33.33 / 33.34' => [10, [3333, 3333, 3334], [3, 3, 4]];
        yield 'a £1,000.00 deposit on a 75 / 25 cost' => [100000, [7500, 2500], [75000, 25000]];
        yield 'a payment against settled parts, No payer yet last' => [100000, [340000, 0, 160000], [68000, 0, 32000]];
    }

    /**
     * @param list<int> $weights
     * @param list<int> $expected
     */
    #[Test]
    #[DataProvider('splits')]
    public function partsAddUpToTheAmountAndEachIsWithinOneMinorUnit(int $amount, array $weights, array $expected): void
    {
        $parts = Apportioner::apportion(new Number($amount), Vec\map($weights, static fn (int $weight): Number => new Number($weight)));

        self::assertSame($expected, Vec\map($parts, static fn (Number $part): int => (int) (string) $part));
    }

    #[Test]
    public function weightsOfNothingGiveNothingToAnyone(): void
    {
        $parts = Apportioner::apportion(new Number(500), [new Number(0), new Number(0)]);

        self::assertSame(['0', '0'], Vec\map($parts, static fn (Number $part): string => (string) $part));
    }

    #[Test]
    public function amountsPastAnIntSplitExactly(): void
    {
        $parts = Apportioner::apportion(new Number('99999999999999999'), [new Number(3333), new Number(3333), new Number(3334)]);

        self::assertSame('99999999999999999', (string) $parts[0]->add($parts[1])->add($parts[2]));
    }
}
