<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Guest\Export\XlsxFile;
use DOMDocument;
use DOMElement;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\File;
use Psl\Filesystem;
use Psl\Str;
use Psl\Vec;
use ZipArchive;

/** Each column of the guest export's workbook opens wide enough for its longest cell, between 10 and 50 characters (sc-65030). */
final class XlsxFileTest extends TestCase
{
    #[Test]
    public function everyColumnHasItsOwnWidth(): void
    {
        $sheet = $this->sheet([['Full name', 'Email', 'Places'], ['Bisi', 'bisi@example.com', '1']]);

        self::assertSame([['1', '1', '11'], ['2', '2', '18'], ['3', '3', '10']], $this->columns($sheet));
        foreach ($sheet->getElementsByTagName('col') as $column) {
            self::assertSame('1', $column->getAttribute('customWidth'));
        }
    }

    #[Test]
    public function aHeadingLongerThanEveryValueSetsTheWidth(): void
    {
        self::assertSame(['15'], $this->widths([['Mobile number'], ['+234803123456'], ['']]));
    }

    #[Test]
    public function aValueLongerThanItsHeadingSetsTheWidth(): void
    {
        self::assertSame(['17'], $this->widths([['Reply'], ['Yes'], ['Not yet invited']]));
    }

    #[Test]
    public function aNarrowColumnIsNeverUnderTen(): void
    {
        self::assertSame(['10', '10'], $this->widths([['Diet', ''], ['', '']]));
    }

    #[Test]
    public function aLongValueStopsItsColumnAtFiftyAndIsWrittenWhole(): void
    {
        $long = Str\repeat('a', 48);
        $longer = Str\repeat('b', 49) . ' and on to the end';

        self::assertSame(['50'], $this->widths([['Email'], [$long]]));
        self::assertSame(['50'], $this->widths([['Email'], [$longer]]));
        self::assertSame($longer, $this->sheet([['Email'], [$longer]])->getElementsByTagName('t')->item(1)?->textContent);
    }

    #[Test]
    public function anAccentedHeadingIsCountedInLetters(): void
    {
        self::assertSame(['21'], $this->widths([['Número de telemóvel']]));
        self::assertSame(['13'], $this->widths([['Ẹ̀kọ́ Ọlá Zoë']]));
    }

    /**
     * @param list<list<string>> $rows
     *
     * @return list<string>
     */
    private function widths(array $rows): array
    {
        return Vec\map($this->columns($this->sheet($rows)), static fn (array $column): string => $column[2]);
    }

    /** @return list<array{string, string, string}> each column's min, max and width */
    private function columns(DOMDocument $sheet): array
    {
        $columns = [];
        foreach ($sheet->getElementsByTagName('col') as $column) {
            self::assertInstanceOf(DOMElement::class, $column);
            $columns[] = [$column->getAttribute('min'), $column->getAttribute('max'), $column->getAttribute('width')];
        }

        return $columns;
    }

    /** @param list<list<string>> $rows */
    private function sheet(array $rows): DOMDocument
    {
        $path = Filesystem\create_temporary_file();
        File\write($path, XlsxFile::of('Guests', $rows), File\WriteMode::Truncate);
        $zip = new ZipArchive();
        self::assertTrue($zip->open($path));
        $xml = $zip->getFromName('xl/worksheets/sheet1.xml');
        $zip->close();
        Filesystem\delete_file($path);
        self::assertIsString($xml);

        $document = new DOMDocument();
        self::assertTrue($document->loadXML($xml));

        return $document;
    }
}
