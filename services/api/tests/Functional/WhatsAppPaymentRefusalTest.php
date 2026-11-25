<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Messaging\Channel\WhatsAppPaymentRefusal;
use App\Tests\ApiTestCase;
use App\Tests\Double\RecordingLogger;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Vec;

/** sc-45470: Meta's delivery report of a payment refusal, for any message, is a critical line for ops. */
final class WhatsAppPaymentRefusalTest extends ApiTestCase
{
    private RecordingLogger $logger;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->logger = new RecordingLogger();
        self::getContainer()->set(WhatsAppPaymentRefusal::class, new WhatsAppPaymentRefusal($this->logger));
    }

    #[Test]
    public function aReportedPaymentRefusalWritesACriticalLineEvenForAMessageWeDidNotRecord(): void
    {
        $this->report([self::failed('wamid.unknown', [self::error(131042, 'Business eligibility payment issue')])]);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame([['level' => 'critical', 'message' => WhatsAppPaymentRefusal::MESSAGE]], $this->criticals());
        self::assertSame(['message_id' => 'wamid.unknown', 'error_title' => 'Business eligibility payment issue'], $this->logger->contexts[0], 'no number, no text');
    }

    #[Test]
    public function eachRefusedMessageWritesItsOwnLine(): void
    {
        $this->report([
            self::failed('wamid.1', [self::error(131042, 'Business eligibility payment issue')]),
            self::failed('wamid.2', [self::error(131042, 'Business eligibility payment issue')]),
        ]);

        self::assertCount(2, $this->criticals());
    }

    #[Test]
    public function aGuestsOwnFailureOrAFailureWithNoErrorsWritesNoCriticalLine(): void
    {
        $this->report([
            self::failed('wamid.1', [self::error(131026, 'Message undeliverable')]),
            self::failed('wamid.2', [self::error(131049, 'This message was not delivered to maintain healthy ecosystem engagement.')]),
            self::failed('wamid.3', []),
            ['id' => 'wamid.4', 'status' => 'failed', 'recipient_id' => '2348035550142'],
        ]);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame([], $this->criticals());
    }

    #[Test]
    public function aReportThatIsNotFailedWritesNoCriticalLine(): void
    {
        $this->report([['id' => 'wamid.1', 'status' => 'delivered', 'errors' => [self::error(131042, 'Business eligibility payment issue')]]]);

        self::assertSame([], $this->criticals());
    }

    #[Test]
    public function aForgedReportCannotRaiseTheAlert(): void
    {
        $this->report([self::failed('wamid.1', [self::error(131042, 'Business eligibility payment issue')])], signedWith: 'a guessed secret');

        self::assertSame(403, $this->client->getResponse()->getStatusCode());
        self::assertSame([], $this->logger->records);
    }

    /** @return list<array{level: mixed, message: string}> */
    private function criticals(): array
    {
        return Vec\filter($this->logger->records, static fn (array $record): bool => 'critical' === $record['level']);
    }

    /**
     * @param list<array<string, mixed>> $errors
     *
     * @return array<string, mixed>
     */
    private static function failed(string $id, array $errors): array
    {
        return ['id' => $id, 'status' => 'failed', 'timestamp' => '1763800000', 'recipient_id' => '2348035550142', 'errors' => $errors];
    }

    /** @return array<string, mixed> */
    private static function error(int $code, string $title): array
    {
        return ['code' => $code, 'title' => $title, 'message' => $title, 'error_data' => ['details' => 'Details from Meta.']];
    }

    /** @param list<array<string, mixed>> $statuses */
    private function report(array $statuses, string $signedWith = 'development-app-secret'): void
    {
        $body = Json\encode(['object' => 'whatsapp_business_account', 'entry' => [['id' => '1', 'changes' => [['field' => 'messages', 'value' => ['messaging_product' => 'whatsapp', 'statuses' => $statuses]]]]]]);

        $this->client->request('POST', '/api/webhooks/whatsapp', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_HUB_SIGNATURE_256' => 'sha256=' . \hash_hmac('sha256', $body, $signedWith),
        ], content: $body);
    }
}
