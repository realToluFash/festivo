<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Controller\MailWebhookController;
use App\Domain\Messaging\EmailSuppressions;
use App\Domain\Messaging\Webhook\MailWebhook;
use App\Domain\User\Mail\UserMailer;
use App\Enum\AccountMail;
use App\Tests\ApiTestCase;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Symfony\Component\HttpFoundation\Request;

final class MailWebhookTest extends ApiTestCase
{
    private const string RANGES = '127.0.0.0/8,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16';

    #[Test]
    public function aDeliveryReportIsRecordedOnItsDelivery(): void
    {
        $delivery = $this->sentTo('ada@example.test');

        $this->report(['RecordType' => 'Delivery', 'Recipient' => 'ada@example.test', 'Metadata' => ['delivery' => $delivery]]);

        self::assertResponseStatusCodeSame(200);
        self::assertSame(['sent', 'delivered'], $this->state($delivery));
        self::assertNotNull(self::connection()->fetchOne('SELECT provider_reported_at FROM notification_deliveries WHERE id = :id', ['id' => $delivery]));
        self::assertFalse(self::service(EmailSuppressions::class)->isSuppressed('ada@example.test'));
    }

    #[Test]
    public function aHardBounceIsRecordedAndSuppressesTheAddress(): void
    {
        $delivery = $this->sentTo('ada@example.test');

        $this->report(['RecordType' => 'Bounce', 'Type' => 'HardBounce', 'Email' => 'Ada@example.test', 'Metadata' => ['delivery' => $delivery]]);

        self::assertResponseStatusCodeSame(200);
        self::assertSame(['sent', 'bounced'], $this->state($delivery));
        self::assertTrue(self::service(EmailSuppressions::class)->isSuppressed('ada@example.test'));
    }

    #[Test]
    public function aComplaintIsRecordedSuppressesAndIsNotUndoneByALaterDelivery(): void
    {
        $delivery = $this->sentTo('ada@example.test');

        $this->report(['RecordType' => 'SpamComplaint', 'Email' => 'ada@example.test', 'Metadata' => ['delivery' => $delivery]]);
        $this->report(['RecordType' => 'Delivery', 'Recipient' => 'ada@example.test', 'Metadata' => ['delivery' => $delivery]]);

        self::assertSame(['sent', 'complained'], $this->state($delivery));
        self::assertTrue(self::service(EmailSuppressions::class)->isSuppressed('ada@example.test'));
    }

    #[Test]
    public function aSoftBounceChangesNothing(): void
    {
        $delivery = $this->sentTo('ada@example.test');

        $this->report(['RecordType' => 'Bounce', 'Type' => 'SoftBounce', 'Email' => 'ada@example.test', 'Metadata' => ['delivery' => $delivery]]);

        self::assertResponseStatusCodeSame(200);
        self::assertSame(['sent', null], $this->state($delivery));
        self::assertFalse(self::service(EmailSuppressions::class)->isSuppressed('ada@example.test'));
    }

    #[Test]
    public function wrongCredentialsAreRefusedAndChangeNothing(): void
    {
        $delivery = $this->sentTo('ada@example.test');

        $this->report(['RecordType' => 'Bounce', 'Type' => 'HardBounce', 'Email' => 'ada@example.test', 'Metadata' => ['delivery' => $delivery]], credentials: 'postmark:guessed');
        self::assertResponseStatusCodeSame(401);
        $this->report(['RecordType' => 'Bounce', 'Type' => 'HardBounce', 'Email' => 'ada@example.test', 'Metadata' => ['delivery' => $delivery]], credentials: null);
        self::assertResponseStatusCodeSame(401);

        self::assertSame(['sent', null], $this->state($delivery));
        self::assertFalse(self::service(EmailSuppressions::class)->isSuppressed('ada@example.test'));
    }

    #[Test]
    public function anAddressOutsideTheRangesIsRefusedAndChangesNothing(): void
    {
        $delivery = $this->sentTo('ada@example.test');

        $this->report(['RecordType' => 'Bounce', 'Type' => 'HardBounce', 'Email' => 'ada@example.test', 'Metadata' => ['delivery' => $delivery]], from: '203.0.113.9');

        self::assertResponseStatusCodeSame(401);
        self::assertSame(['sent', null], $this->state($delivery));
        self::assertFalse(self::service(EmailSuppressions::class)->isSuppressed('ada@example.test'));
    }

    #[Test]
    public function anUnsetSecretOrUnsetRangesRefuseEveryReport(): void
    {
        $delivery = $this->sentTo('ada@example.test');
        $bounce = Json\encode(['RecordType' => 'Bounce', 'Type' => 'HardBounce', 'Email' => 'ada@example.test', 'Metadata' => ['delivery' => $delivery]]);

        foreach ([['', self::RANGES], [self::secret(), ''], ['', '']] as [$secret, $ranges]) {
            $request = Request::create('/api/webhooks/mail', 'POST', server: ['REMOTE_ADDR' => '127.0.0.1', 'PHP_AUTH_USER' => 'postmark', 'PHP_AUTH_PW' => ''], content: $bounce);
            $response = new MailWebhookController(self::service(MailWebhook::class), $secret, $ranges)->report($request);
            self::assertSame(401, $response->getStatusCode());
        }

        self::assertSame(['sent', null], $this->state($delivery));
        self::assertFalse(self::service(EmailSuppressions::class)->isSuppressed('ada@example.test'));
    }

    private function sentTo(string $address): string
    {
        self::service(UserMailer::class)->send(AccountMail::Ownership, $address, 'en', 'ownershipTransferred.subject', ['Body.']);
        self::drainNotifications();

        return Type\string()->coerce(self::connection()->fetchOne("SELECT id FROM notification_deliveries WHERE status = 'sent' ORDER BY created_at DESC LIMIT 1"));
    }

    /** @param array<string, mixed> $report */
    private function report(array $report, ?string $credentials = '', string $from = '127.0.0.1'): void
    {
        $credentials = '' === $credentials ? self::secret() : $credentials;
        $server = ['REMOTE_ADDR' => $from, 'CONTENT_TYPE' => 'application/json'];

        if (null !== $credentials) {
            $server['HTTP_AUTHORIZATION'] = 'Basic ' . \base64_encode($credentials);
        }

        $this->client->request('POST', '/api/webhooks/mail', server: $server, content: Json\encode($report));
    }

    /** @return array{?string, ?string} its status and the provider's report */
    private function state(string $delivery): array
    {
        $row = Type\shape(['status' => Type\string(), 'provider_report' => Type\nullable(Type\string())])->coerce(
            self::connection()->fetchAssociative('SELECT status, provider_report FROM notification_deliveries WHERE id = :id', ['id' => $delivery]),
        );

        return [$row['status'], $row['provider_report']];
    }

    /** The stack's own, as the fixture would send it. */
    private static function secret(): string
    {
        return Type\string()->coerce($_SERVER['MAIL_WEBHOOK_SECRET'] ?? null);
    }

    private static function connection(): Connection
    {
        return self::service(Connection::class);
    }
}
