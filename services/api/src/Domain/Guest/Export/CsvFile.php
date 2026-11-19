<?php

declare(strict_types=1);

namespace App\Domain\Guest\Export;

use Psl\Vec;
use RuntimeException;

/** UTF-8 with a byte order mark, so Excel opens accents as they were typed, and every cell made safe to open (CsvCell). */
final readonly class CsvFile
{
    private const string BOM = "\u{FEFF}";

    /** @param list<list<string>> $rows the headings first */
    public static function of(array $rows): string
    {
        $stream = \fopen('php://temp', 'r+') ?: throw new RuntimeException('No memory stream for the CSV file.');

        foreach ($rows as $row) {
            \fputcsv($stream, Vec\map($row, CsvCell::safe(...)), ',', '"', '', "\r\n");
        }

        \rewind($stream);
        $written = \stream_get_contents($stream);
        \fclose($stream);

        return self::BOM . (false === $written ? '' : $written);
    }
}
