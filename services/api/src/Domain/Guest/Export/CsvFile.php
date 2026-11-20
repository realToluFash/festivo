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
        self::start($stream);

        foreach ($rows as $row) {
            self::row($stream, $row);
        }

        \rewind($stream);
        $written = \stream_get_contents($stream);
        \fclose($stream);

        return false === $written ? '' : $written;
    }

    /** @param resource $stream */
    public static function start($stream): void
    {
        \fwrite($stream, self::BOM);
    }

    /**
     * @param resource     $stream
     * @param list<string> $row
     */
    public static function row($stream, array $row): void
    {
        \fputcsv($stream, Vec\map($row, CsvCell::safe(...)), ',', '"', '', "\r\n");
    }
}
