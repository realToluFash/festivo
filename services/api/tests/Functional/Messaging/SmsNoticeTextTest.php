<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Sms\SmsNoticeText;
use App\Domain\Messaging\Sms\SmsSegmentCounter;
use App\Domain\Messaging\Sms\SmsSenders;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Contracts\Translation\TranslatorInterface;

final class SmsNoticeTextTest extends KernelTestCase
{
    private const string LINK = 'https://soirely.com/g/abc';

    private const string STOP_LINK = 'https://soirely.com/your-messages#xyz';

    #[Test]
    public function aNigerianNumberGetsTheAlphanumericIdAndABritishOneTheNumber(): void
    {
        $senders = new SmsSenders('+447700900999', '234=Soirely');

        self::assertSame(['Soirely', false], [$senders->to('+2348012345678')->sender, $senders->to('+2348012345678')->takesReplies]);
        self::assertSame(['+447700900999', true], [$senders->to('+447700900123')->sender, $senders->to('+447700900123')->takesReplies]);
    }

    #[Test]
    public function withNoneConfiguredEveryNumberGetsSoirelysNumber(): void
    {
        self::assertSame('+447700900999', new SmsSenders('+447700900999', '')->to('+2348012345678')->sender);
    }

    #[Test]
    public function theHostsComeFirstAndALaterTextEndsAtTheLink(): void
    {
        self::assertSame(
            'Amara & Tomi: a new message about Wedding. Read it here: ' . self::LINK,
            $this->text('Wedding', '+447700900123', first: false),
        );
    }

    #[Test]
    public function aFirstTextEndsOnTheStopLine(): void
    {
        self::assertStringEndsWith(self::LINK . "\nReply STOP to opt out.", $this->text('Wedding', '+447700900123', first: true));
    }

    #[Test]
    public function aFirstTextFromTheAlphanumericIdEndsOnTheStopLinkAndNeverTheStopLine(): void
    {
        $text = $this->text('Wedding', '+2348012345678', first: true);

        self::assertStringEndsWith(self::LINK . "\nStop texts: " . self::STOP_LINK, $text);
        self::assertStringNotContainsString('STOP', $text);
    }

    #[Test]
    public function aTypographicApostropheGoesPlainInGsm7(): void
    {
        $text = $this->text("Ada\u{2019}s wedding", '+447700900123', first: false);

        self::assertStringContainsString("Ada's wedding", $text);
        self::assertFalse(SmsSegmentCounter::count($text)->unicode);
    }

    #[Test]
    public function aLetterOutsideGsm7GoesAsWrittenInUnicode(): void
    {
        $text = $this->text('Adéọlá turns 30', '+447700900123', first: false);

        self::assertStringContainsString('Adéọlá turns 30', $text);
        self::assertTrue(SmsSegmentCounter::count($text)->unicode);
    }

    private function text(string $event, string $to, bool $first): string
    {
        $translator = self::getContainer()->get(TranslatorInterface::class);
        self::assertInstanceOf(TranslatorInterface::class, $translator);

        return new SmsNoticeText($translator)->of('Amara & Tomi', $event, self::LINK, 'en', new SmsSenders('+447700900999', '234=Soirely')->to($to), $first, self::STOP_LINK);
    }
}
