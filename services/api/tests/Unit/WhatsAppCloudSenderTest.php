<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Messaging\Channel\WhatsAppPaymentRefusal;
use App\Integrations\Meta\WhatsAppCloudSender;
use App\Tests\Double\RecordingLogger;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Json;
use RuntimeException;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

/** sc-45470: Meta answering the send itself with its payment refusal. */
final class WhatsAppCloudSenderTest extends TestCase
{
    private RecordingLogger $logger;

    protected function setUp(): void
    {
        $this->logger = new RecordingLogger();
    }

    #[Test]
    public function aPaymentRefusalWritesOneCriticalLineWithNoNumber(): void
    {
        $this->refusedWith(131042, '(#131042) Business eligibility payment issue');

        self::assertSame([['level' => 'critical', 'message' => WhatsAppPaymentRefusal::MESSAGE]], $this->logger->records);
        self::assertSame(['message_id' => null, 'error_title' => '(#131042) Business eligibility payment issue'], $this->logger->contexts[0]);
    }

    #[Test]
    public function aGuestsOwnFailureWritesNoCriticalLine(): void
    {
        $this->refusedWith(131026, 'Message undeliverable');

        self::assertSame([], $this->logger->records);
    }

    #[Test]
    public function aRefusalThatIsNotMetasErrorShapeWritesNothing(): void
    {
        $this->expectException(RuntimeException::class);

        try {
            $this->sender(new MockResponse('<html>Bad gateway</html>', ['http_code' => 502]))->sendCode('+2348039750142', '123456', 'en');
        } finally {
            self::assertSame([], $this->logger->records);
        }
    }

    private function refusedWith(int $code, string $message): void
    {
        $body = Json\encode(['error' => ['message' => $message, 'type' => 'OAuthException', 'code' => $code, 'fbtrace_id' => 'trace']]);

        try {
            $this->sender(new MockResponse($body, ['http_code' => 400]))->sendCode('+2348039750142', '123456', 'en');
            self::fail('a refused message is still a failed send');
        } catch (RuntimeException) {
        }
    }

    private function sender(MockResponse $response): WhatsAppCloudSender
    {
        return new WhatsAppCloudSender(new MockHttpClient($response), 'http://meta.test/v21.0', '1234', 'token', 'soirely_code', new WhatsAppPaymentRefusal($this->logger));
    }
}
