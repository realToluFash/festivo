<?php

declare(strict_types=1);

namespace App\Domain\Guest\Export;

use RuntimeException;

/** UTF-8 with a byte order mark, so Excel opens accents as they were typed. */
final readonly class CsvFile
{
    private const string BOM = "\u{FEFF}";

    /** @param list<list<string>> $rows the headings first */
    public static function of(array $rows): string
    {
        $stream = \fopen('php://temp', 'r+') ?: throw new RuntimeException('No memory stream for the CSV file.');

        foreach ($rows as $row) {
            \fputcsv($stream, $row, ',', '"', '', "\r\n");
        }

        \rewind($stream);
        $written = \stream_get_contents($stream);
        \fclose($stream);

        return self::BOM . (false === $written ? '' : $written);
    }
}
