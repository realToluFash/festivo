<?php

declare(strict_types=1);

namespace App\Tests\Unit\Domain\Messaging;

use App\Domain\Messaging\Sms\SmsKeywordReader;
use App\Enum\SmsKeywordAction;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class SmsKeywordReaderTest extends TestCase
{
    /** @return iterable<string, array{string, SmsKeywordAction, ?string}> */
    public static function keywords(): iterable
    {
        foreach (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'] as $word) {
            yield $word => [$word, SmsKeywordAction::Stop, null];
        }

        yield 'ARRÊT in lower case' => ['arrêt', SmsKeywordAction::Stop, 'fr'];
        yield 'ARRET without its accent' => ['Arret', SmsKeywordAction::Stop, 'fr'];
        yield 'BAJA' => ['BAJA', SmsKeywordAction::Stop, 'es'];
        yield 'PARAR' => ['PARAR', SmsKeywordAction::Stop, 'pt'];
        yield 'SAIR' => ['SAIR', SmsKeywordAction::Stop, 'pt'];
        yield 'START' => ['start', SmsKeywordAction::Start, null];
        yield 'UNSTOP' => ['UNSTOP', SmsKeywordAction::Start, null];
        yield 'HELP with punctuation' => [' Help! ', SmsKeywordAction::Help, null];
    }

    #[Test]
    #[DataProvider('keywords')]
    public function aKeywordIsRead(string $body, SmsKeywordAction $action, ?string $language): void
    {
        $keyword = SmsKeywordReader::read($body);

        self::assertSame([$action, $language], [$keyword?->action, $keyword?->language]);
    }

    #[Test]
    public function aSentenceHoldingAKeywordIsNotOne(): void
    {
        self::assertNull(SmsKeywordReader::read('Please do not stop'));
        self::assertNull(SmsKeywordReader::read(''));
    }
}
