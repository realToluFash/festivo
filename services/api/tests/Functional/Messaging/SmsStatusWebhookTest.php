<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Integrations\Twilio\TwilioSignature;
use App\Tests\ApiTestCase;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Component\HttpFoundation\Request;

final class SmsStatusWebhookTest extends ApiTestCase
{
    private const string PATH = '/api/webhooks/sms/status';

    private const string SID = 'SM0123456789abcdef0123456789abcdef';

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::service(Connection::class)->executeStatement('DELETE FROM notification_deliveries');
        self::service(Connection::class)->executeStatement('DELETE FROM scheduled_notifications');
        self::service(Connection::class)
            ->executeStatement(
                <<<'SQL'
                    WITH s AS (
                        INSERT INTO scheduled_notifications (id, type, cancellation_key, source_id, trigger, due_at, audience, payload, priority, status, created_at)
                        VALUES (gen_random_uuid(), 'mail.new_device', 'k', 's', '{}', NOW(), '{}', '{}', 0, 'fanned_out', NOW())
                        RETURNING id
                    )
                    INSERT INTO notification_deliveries (
                        id, scheduled_notification_id, type, source_id, recipient_kind, recipient_id, channel, priority, status,
                        due_at, next_attempt_at, attempts, created_at, finished_at, provider_message_id
                    )
                    SELECT gen_random_uuid(), s.id, 'mail.new_device', 'source', 'person', gen_random_uuid(), 'email', 0, 'sent',
                           NOW(), NOW(), 1, NOW(), NOW(), :sid
                    FROM s
                    SQL,
                ['sid' => self::SID],
            );
    }

    #[Test]
    public function aDeliveredReportIsKept(): void
    {
        $this->report('delivered');

        self::assertResponseStatusCodeSame(204);
        self::assertSame('delivered', $this->column('provider_report'));
    }

    #[Test]
    public function anUndeliveredReportKeepsTwiliosErrorCode(): void
    {
        $this->report('undelivered', '30003');

        self::assertSame('bounced', $this->column('provider_report'));
        self::assertSame('30003', $this->column('provider_code'));
    }

    #[Test]
    public function aFailedReportCountsAsUndelivered(): void
    {
        $this->report('failed', '30008');

        self::assertSame('bounced', $this->column('provider_report'));
    }

    #[Test]
    public function queuedAndSentChangeNothing(): void
    {
        $this->report('queued');
        $this->report('sent');

        self::assertNull($this->column('provider_report'));
    }

    #[Test]
    public function aLaterDeliveredNeverReplacesAnUndelivered(): void
    {
        $this->report('undelivered', '30003');
        $this->report('delivered');

        self::assertSame('bounced', $this->column('provider_report'));
    }

    #[Test]
    public function anUnsignedReportIsRefusedAndChangesNothing(): void
    {
        $this->client->request(Request::METHOD_POST, self::PATH, [
            'MessageSid' => self::SID,
            'MessageStatus' => 'delivered',
        ]);

        self::assertResponseStatusCodeSame(403);
        self::assertNull($this->column('provider_report'));
    }

    private function report(string $status, ?string $errorCode = null): void
    {
        $fields =
            ['MessageSid' => self::SID, 'MessageStatus' => $status]
            + (null === $errorCode ? [] : ['ErrorCode' => $errorCode]);
        $signature = self::service(TwilioSignature::class);
        $this->client->request(
            Request::METHOD_POST,
            self::PATH,
            $fields,
            [],
            ['HTTP_X_TWILIO_SIGNATURE' => $signature->of($signature->url(self::PATH), $fields)],
        );
    }

    private function column(string $column): mixed
    {
        $value = self::service(Connection::class)->fetchOne('SELECT ' . $column . ' FROM notification_deliveries');

        return false === $value ? null : $value;
    }
}
