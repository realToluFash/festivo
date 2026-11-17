<?php

declare(strict_types=1);

namespace App\Domain\Guest\Export;

use Psl\File;
use Psl\Filesystem;
use Psl\Math;
use Psl\Regex;
use Psl\Str;
use Psl\Str\Grapheme;
use Psl\Vec;
use RuntimeException;
use XMLWriter;
use ZipArchive;

/** The smallest workbook Excel, Numbers and Sheets all open: one sheet of text cells, the headings in bold, each column as wide as its longest cell. */
final readonly class XlsxFile
{
    private const string MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

    private const string RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    private const int NARROWEST = 10;

    private const int WIDEST = 50;

    private const int MARGIN = 2;

    /** @param list<list<string>> $rows the headings first */
    public static function of(string $sheet, array $rows): string
    {
        $path = Filesystem\create_temporary_file(prefix: 'guest-export-');

        try {
            $zip = new ZipArchive();
            if (true !== $zip->open($path, ZipArchive::OVERWRITE)) {
                throw new RuntimeException('The workbook could not be opened for writing.');
            }

            $zip->addFromString('[Content_Types].xml', self::contentTypes());
            $zip->addFromString('_rels/.rels', self::rootRelationships());
            $zip->addFromString('xl/workbook.xml', self::workbook($sheet));
            $zip->addFromString('xl/_rels/workbook.xml.rels', self::workbookRelationships());
            $zip->addFromString('xl/styles.xml', self::styles());
            $zip->addFromString('xl/worksheets/sheet1.xml', self::worksheet($rows));
            $zip->close();

            return File\read($path);
        } finally {
            Filesystem\delete_file($path);
        }
    }

    /** @param list<list<string>> $rows */
    private static function worksheet(array $rows): string
    {
        $xml = self::document();
        $xml->startElement('worksheet');
        $xml->writeAttribute('xmlns', self::MAIN);
        $xml->startElement('cols');
        foreach (self::widths($rows) as $column => $width) {
            $xml->startElement('col');
            $xml->writeAttribute('min', (string) ($column + 1));
            $xml->writeAttribute('max', (string) ($column + 1));
            $xml->writeAttribute('width', (string) $width);
            $xml->writeAttribute('customWidth', '1');
            $xml->endElement();
        }
        $xml->endElement();
        $xml->startElement('sheetData');

        foreach ($rows as $at => $row) {
            $xml->startElement('row');
            $xml->writeAttribute('r', (string) ($at + 1));

            foreach ($row as $column => $value) {
                $xml->startElement('c');
                $xml->writeAttribute('r', self::column($column) . ($at + 1));
                $xml->writeAttribute('t', 'inlineStr');
                if (0 === $at) {
                    $xml->writeAttribute('s', '1');
                }
                $xml->startElement('is');
                $xml->startElement('t');
                $xml->writeAttribute('xml:space', 'preserve');
                $xml->text(self::xmlSafe($value));
                $xml->endElement();
                $xml->endElement();
                $xml->endElement();
            }

            $xml->endElement();
        }

        $xml->endElement();
        $xml->endElement();

        return $xml->outputMemory();
    }

    /**
     * In characters, as a person counts them: é is one.
     *
     * @param list<list<string>> $rows
     *
     * @return list<int>
     */
    private static function widths(array $rows): array
    {
        $longest = [];
        foreach ($rows as $row) {
            foreach ($row as $column => $value) {
                $longest[$column] = Math\maxva($longest[$column] ?? 0, Grapheme\length(self::xmlSafe($value)));
            }
        }

        return Vec\map($longest, static fn (int $length): int => Math\clamp($length + self::MARGIN, self::NARROWEST, self::WIDEST));
    }

    private static function workbook(string $sheet): string
    {
        $xml = self::document();
        $xml->startElement('workbook');
        $xml->writeAttribute('xmlns', self::MAIN);
        $xml->writeAttribute('xmlns:r', self::RELATIONSHIPS);
        $xml->startElement('sheets');
        $xml->startElement('sheet');
        $xml->writeAttribute('name', self::sheetName($sheet));
        $xml->writeAttribute('sheetId', '1');
        $xml->writeAttribute('r:id', 'rId1');
        $xml->endElement();
        $xml->endElement();
        $xml->endElement();

        return $xml->outputMemory();
    }

    private static function contentTypes(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . '</Types>';
    }

    private static function rootRelationships(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>';
    }

    private static function workbookRelationships(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            . '</Relationships>';
    }

    private static function styles(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="' . self::MAIN . '">'
            . '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
            . '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
            . '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
            . '</styleSheet>';
    }

    private static function document(): XMLWriter
    {
        $xml = new XMLWriter();
        $xml->openMemory();
        $xml->startDocument('1.0', 'UTF-8', 'yes');

        return $xml;
    }

    /** A, B, … Z, AA: the column's letters. */
    private static function column(int $index): string
    {
        $letters = '';
        for ($left = $index + 1; $left > 0; $left = Math\div($left - 1, 26)) {
            $letters = Str\Byte\chr(65 + (($left - 1) % 26)) . $letters;
        }

        return $letters;
    }

    /** XML 1.0 has no place for most control characters, and one left in makes the whole file unreadable. */
    private static function xmlSafe(string $value): string
    {
        return Regex\replace($value, '/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '');
    }

    /** Excel refuses a sheet name over 31 characters or with any of []:*?/\ in it. */
    private static function sheetName(string $name): string
    {
        return Str\slice(Regex\replace($name, '/[\[\]:*?\/\\\\]/', ''), 0, 31);
    }
}
