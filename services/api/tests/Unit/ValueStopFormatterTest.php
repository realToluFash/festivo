<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Locale\ValueStopFormatter;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\TestWith;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Translation\Formatter\MessageFormatter;

final class ValueStopFormatterTest extends TestCase
{
    #[Test]
    #[TestWith(['Galas Ltd.', 'Made by Galas Ltd.'])]
    #[TestWith(['Party Time!', 'Made by Party Time!'])]
    #[TestWith(["Who's Next?", "Made by Who's Next?"])]
    #[TestWith(['Galas…', 'Made by Galas…'])]
    #[TestWith(['Galas Ltd..', 'Made by Galas Ltd..'])]
    #[TestWith(['Galas Ltd', 'Made by Galas Ltd.'])]
    #[TestWith(['Galas (Lagos)', 'Made by Galas (Lagos).'])]
    public function aValueEndingInItsOwnStopTakesNoSecond(string $name, string $shown): void
    {
        $formatter = new ValueStopFormatter(new MessageFormatter());

        self::assertSame($shown, $formatter->format('Made by {name}.', 'en', ['{name}' => $name]));
        self::assertSame($shown, $formatter->formatIntl('Made by {name}.', 'en', ['name' => $name]));
    }

    #[Test]
    #[TestWith(['Organisation: {name}, your role', 'Organisation: Galas Ltd., your role'])]
    #[TestWith(['Did you mean {name}?', 'Did you mean Galas Ltd.?'])]
    #[TestWith(['Made by {name} today.', 'Made by Galas Ltd. today.'])]
    #[TestWith(['Nothing matches “{name}”.', 'Nothing matches “Galas Ltd.”.'])]
    public function onlyAFullStopAfterTheValueIsDropped(string $message, string $shown): void
    {
        $formatter = new ValueStopFormatter(new MessageFormatter());

        self::assertSame($shown, $formatter->format($message, 'en', ['{name}' => 'Galas Ltd.']));
        self::assertSame($shown, $formatter->formatIntl($message, 'en', ['{name}' => 'Galas Ltd.']));
    }

    #[Test]
    public function aPluralMessageCountsAsBefore(): void
    {
        $formatter = new ValueStopFormatter(new MessageFormatter());
        $message = '{role}. {count, plural, one {# person holds it.} other {# people hold it.}}';

        self::assertSame('Door team. 1 person holds it.', $formatter->formatIntl($message, 'en', ['role' => 'Door team.', 'count' => 1]));
        self::assertSame('Door team. 12 people hold it.', $formatter->formatIntl($message, 'en', ['role' => 'Door team.', 'count' => 12]));
    }
}
