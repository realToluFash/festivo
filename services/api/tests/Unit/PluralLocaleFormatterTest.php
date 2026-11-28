<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Locale\PluralLocaleFormatter;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Translation\Formatter\MessageFormatter;

final class PluralLocaleFormatterTest extends TestCase
{
    private const string DAYS = '{days, plural, one {# dia} other {# dias}}';

    #[Test]
    public function portugueseCountsNoneAsPlural(): void
    {
        $formatter = new PluralLocaleFormatter(new MessageFormatter());

        self::assertSame('0 dias', $formatter->formatIntl(self::DAYS, 'pt', ['days' => 0]));
        self::assertSame('1 dia', $formatter->formatIntl(self::DAYS, 'pt', ['days' => 1]));
    }

    #[Test]
    public function aLocaleWithNoRegionalRuleCountsAsBefore(): void
    {
        $formatter = new PluralLocaleFormatter(new MessageFormatter());

        self::assertSame('0 jour', $formatter->formatIntl('{n, plural, one {# jour} other {# jours}}', 'fr', ['n' => 0]));
    }

    /** @return iterable<string, array{string, non-empty-string}> */
    public static function joinRequestOpenings(): iterable
    {
        yield 'en' => ['en', '1,000 people are waiting'];
        yield 'es' => ['es', '1000 personas esperan'];
        yield 'fr' => ['fr', "1\u{202F}000 personnes attendent"];
        yield 'pt' => ['pt', '1000 pessoas aguardam'];
    }

    /** @param non-empty-string $opening */
    #[Test]
    #[DataProvider('joinRequestOpenings')]
    public function aCountIsWrittenTheWayItsLanguageWritesNumbers(string $locale, string $opening): void
    {
        $formatter = new PluralLocaleFormatter(new MessageFormatter());
        $catalogue = \Psl\Json\decode(\Psl\File\read(\dirname(__DIR__, 2) . "/translations/emails+intl-icu.{$locale}.json"));

        self::assertIsArray($catalogue);
        self::assertStringStartsWith($opening, $formatter->formatIntl($catalogue['joinRequest.waiting.body'], $locale, ['count' => 1000, 'organisation' => 'Acme']));
    }

    #[Test]
    public function portugueseGroupsTenThousandWithANoBreakSpace(): void
    {
        $formatter = new PluralLocaleFormatter(new MessageFormatter());

        self::assertSame("10\u{A0}000 dias", $formatter->formatIntl('{days, plural, one {{days, number, ::group-auto} dia} other {{days, number, ::group-auto} dias}}', 'pt', ['days' => 10000]));
    }
}
