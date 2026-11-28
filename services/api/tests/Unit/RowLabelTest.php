<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Seating\SeatingPlanEditor;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Str;
use Psl\Vec;

/** A new row's label is the next free letter, A to Z, then AA (sc-4003). */
final class RowLabelTest extends TestCase
{
    /** @return iterable<string, array{int, string}> */
    public static function labels(): iterable
    {
        yield 'the first' => [1, 'A'];
        yield 'the last single letter' => [26, 'Z'];
        yield 'after Z' => [27, 'AA'];
        yield 'after AZ' => [53, 'BA'];
        yield 'after ZZ' => [703, 'AAA'];
    }

    #[Test]
    #[DataProvider('labels')]
    public function eachNumberHasItsLabel(int $n, string $label): void
    {
        self::assertSame($label, SeatingPlanEditor::rowLabelAt($n));
    }

    #[Test]
    public function theNextLabelIsTheFirstFree(): void
    {
        $aToZ = Vec\map(Vec\range(1, 26), SeatingPlanEditor::rowLabelAt(...));

        self::assertSame('A', SeatingPlanEditor::nextRowLabel([]));
        self::assertSame('C', SeatingPlanEditor::nextRowLabel(['a', 'b', 'd']));
        self::assertSame('AA', SeatingPlanEditor::nextRowLabel(Vec\map($aToZ, Str\lowercase(...))));
    }
}
