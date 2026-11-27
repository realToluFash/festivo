<?php

declare(strict_types=1);

namespace App\Tests\Unit\Domain\Messaging;

use App\Domain\Messaging\Sms\PlainPunctuation;
use App\Domain\Messaging\Sms\SmsSegmentCounter;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Str;

final class SmsSegmentCounterTest extends TestCase
{
    /** @return iterable<string, array{string, int, bool, int}> */
    public static function boundaries(): iterable
    {
        yield 'GSM-7 at one part' => [Str\repeat('a', 160), 1, false, 160];
        yield 'GSM-7 past one part' => [Str\repeat('a', 161), 2, false, 161];
        yield 'GSM-7 at three parts' => [Str\repeat('a', 459), 3, false, 459];
        yield 'GSM-7 past three parts' => [Str\repeat('a', 460), 4, false, 460];
        yield 'Unicode at one part' => [Str\repeat('ọ', 70), 1, true, 70];
        yield 'Unicode past one part' => [Str\repeat('ọ', 71), 2, true, 71];
        yield 'an extension character takes two' => [Str\repeat('a', 159) . '€', 2, false, 161];
        yield 'an extension character is never split' => [Str\repeat('a', 152) . '€' . Str\repeat('a', 152), 3, false, 306];
        yield 'an emoji is two UTF-16 units' => ['🎉', 1, true, 2];
    }

    #[Test]
    #[DataProvider('boundaries')]
    public function aTextIsCountedAsItIsCarried(string $text, int $parts, bool $unicode, int $characters): void
    {
        $count = SmsSegmentCounter::count($text);

        self::assertSame([$parts, $unicode, $characters], [$count->parts, $count->unicode, $count->characters]);
    }

    #[Test]
    public function typographicPunctuationGoesPlainAndLettersStay(): void
    {
        $plain = PlainPunctuation::of('Adéọlá’s “night” – more…');

        self::assertSame('Adéọlá\'s "night" - more...', $plain);
        self::assertFalse(SmsSegmentCounter::count(PlainPunctuation::of('Amara’s wedding'))->unicode);
        self::assertTrue(SmsSegmentCounter::count(PlainPunctuation::of('Ọlá’s wedding'))->unicode);
    }
}
