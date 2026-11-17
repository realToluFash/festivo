<?php

declare(strict_types=1);

namespace App\Domain\Guest\Export;

use Psl\Iter;
use Psl\Str;

/** A CSV carries no types, so a cell Excel would read as a formula is written as text: a guest named "=HYPERLINK(…)" runs nothing in the caterer's spreadsheet (OWASP, CSV Injection). */
final readonly class CsvCell
{
    private const array FORMULA_STARTS = ['=', '+', '-', '@', "\t", "\r"];

    public static function safe(string $value): string
    {
        return Iter\contains(self::FORMULA_STARTS, Str\slice($value, 0, 1)) ? "'" . $value : $value;
    }
}
