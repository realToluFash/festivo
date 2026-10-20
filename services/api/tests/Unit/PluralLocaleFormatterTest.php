<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Locale\PluralLocaleFormatter;
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
}
