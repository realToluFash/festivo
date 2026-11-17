<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Guest\Export\CsvCell;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/** OWASP's CSV Injection rule, as decided for the guest export's CSV (sc-3784): a tab and a carriage return can't reach a cell through a trimmed field, so they are tested here. */
final class CsvCellTest extends TestCase
{
    /** @return iterable<string, array{string}> */
    public static function formulaStarts(): iterable
    {
        foreach (['=' => 'equals', '+' => 'plus', '-' => 'minus', '@' => 'at', "\t" => 'tab', "\r" => 'carriage return'] as $start => $name) {
            yield $name => [$start];
        }
    }

    #[Test]
    #[DataProvider('formulaStarts')]
    public function aCellStartingAsAFormulaIsPrefixedWithAQuote(string $start): void
    {
        self::assertSame("'" . $start . 'SUM(A1:A9)', CsvCell::safe($start . 'SUM(A1:A9)'));
    }

    #[Test]
    public function anyOtherCellIsLeftAsItIs(): void
    {
        foreach (['Bisi', ' =SUM(A1)', 'Ọlá', '', "a\t=b", '2026-11-17'] as $cell) {
            self::assertSame($cell, CsvCell::safe($cell));
        }
    }
}
