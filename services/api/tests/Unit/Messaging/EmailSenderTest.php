<?php

declare(strict_types=1);

namespace App\Tests\Unit\Messaging;

use App\Domain\Messaging\Channel\EmailSender;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;
use Symfony\Component\Uid\Uuid;

final class EmailSenderTest extends TestCase
{
    #[Test]
    public function anUnsubscribeLinkIsOneHttpsUrlAndNoMailto(): void
    {
        $sent = null;
        $mailer = $this->createStub(MailerInterface::class);
        $mailer->method('send')->willReturnCallback(static function (RawMessage $message) use (&$sent): void {
            $sent = $message;
        });

        new EmailSender($mailer, 'hello@soirely.com')->send(
            Uuid::v7(),
            new Recipient(NotificationAudienceKind::Guest, Uuid::v7(), 'Ada', 'en', 'ada@example.com'),
            NotificationCategory::Messages,
            new RenderedNotification('Hi', 'Body', unsubscribe: 'https://soirely.com/unsubscribe/abc'),
        );

        self::assertInstanceOf(Email::class, $sent);
        self::assertSame('<https://soirely.com/unsubscribe/abc>', $sent->getHeaders()->get('List-Unsubscribe')?->getBodyAsString());
        self::assertSame('List-Unsubscribe=One-Click', $sent->getHeaders()->get('List-Unsubscribe-Post')?->getBodyAsString());
    }
}
