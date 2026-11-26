<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Locale\VisibleText;
use Normalizer;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Str;

final class VisibleTextTest extends TestCase
{
    private const string YORUBA = 'Ẹ̀gbẹ́ Ọ̀rẹ́ Ìyàwó Àgbà';

    #[Test]
    #[DataProvider('texts')]
    public function aTextCountsTheLettersItsReaderSees(string $text, int $length): void
    {
        self::assertSame($length, VisibleText::length($text));
    }

    /** @return iterable<string, array{string, int}> */
    public static function texts(): iterable
    {
        yield 'Yoruba, composed' => [(string) \normalizer_normalize(self::YORUBA, Normalizer::FORM_C), 19];
        yield 'Yoruba, decomposed' => [(string) \normalizer_normalize(self::YORUBA, Normalizer::FORM_D), 19];
        yield 'a family and a flag' => ["\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467} \u{1F1F3}\u{1F1EC}", 3];
        yield 'Latin' => ['Adaeze', 6];
    }

    #[Test]
    public function aTextOfTheLimitInMarkedLettersFitsAndOneMoreDoesNot(): void
    {
        $decomposed = Str\repeat("e\u{0323}\u{0300}", 30);

        self::assertFalse(VisibleText::tooLong($decomposed, 30));
        self::assertTrue(VisibleText::tooLong($decomposed . "e\u{0323}\u{0300}", 30));
        self::assertFalse(VisibleText::tooLong(Str\repeat('a', 30), 30));
        self::assertTrue(VisibleText::tooLong(Str\repeat('a', 31), 30));
    }

    #[Test]
    public function marksStackedWithoutEndAreRefusedPastFourCodePointsALetter(): void
    {
        self::assertFalse(VisibleText::tooLong('a' . Str\repeat("\u{0301}", 39), 10));
        self::assertTrue(VisibleText::tooLong('a' . Str\repeat("\u{0301}", 40), 10));
        self::assertSame(40, VisibleText::codePoints(10));
    }

    #[Test]
    public function aTextIsTrimmedOfEverySpaceABrowserTrims(): void
    {
        self::assertSame('', VisibleText::trim("\u{3000}\u{3000}"));
        self::assertSame('Auntie Bisi', VisibleText::trim("\u{2003} Auntie Bisi\u{205F}\u{00A0}\n"));
        self::assertSame("Auntie\u{3000}Bisi", VisibleText::trim("Auntie\u{3000}Bisi"));
    }
}
