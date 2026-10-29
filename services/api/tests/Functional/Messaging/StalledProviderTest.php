<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Channel\EmailSender;
use App\Domain\Messaging\Command\WorkNotificationsCommand;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\Mailer;
use Symfony\Component\Mailer\Transport;
use Symfony\Component\Uid\Uuid;

final class StalledProviderTest extends TestCase
{
    /** An SMTP server that accepts the connection and never answers: what a hung provider looks like to the worker. */
    #[Test]
    public function aProviderThatNeverAnswersIsAFailedAttemptWithinTheWorkersLimit(): void
    {
        $server = \stream_socket_server('tcp://127.0.0.1:0') ?: self::fail('No listening socket.');
        $address = \stream_socket_get_name($server, false) ?: self::fail('No address.');
        $previous = \ini_get('default_socket_timeout');
        // @mago-expect lint:no-ini-set the worker's own setting, which is what is under test
        \ini_set('default_socket_timeout', (string) WorkNotificationsCommand::PROVIDER_CALL_LIMIT);
        $sender = new EmailSender(new Mailer(Transport::fromDsn('smtp://' . $address)), 'Soirely <hello@soirely.test>');
        $started = \microtime(true);

        try {
            $sender->send(Uuid::v7(), new Recipient(NotificationAudienceKind::Member, Uuid::v7(), 'Ada', 'en', 'ada@example.test'), NotificationCategory::AccountSecurity, new RenderedNotification('Code', '123456'));
            self::fail('A silent provider was taken for a sent message.');
        } catch (TransportException) {
            self::assertLessThan(5.0, \microtime(true) - $started);
        } finally {
            // @mago-expect lint:no-ini-set put back for the rest of the suite
            \ini_set('default_socket_timeout', (string) $previous);
            \fclose($server);
        }
    }
}
