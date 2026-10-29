<?php

declare(strict_types=1);

namespace App\Integrations\WebPush;

use App\Domain\Messaging\Interfaces\PushServiceInterface;
use App\Domain\Messaging\Model\PushTarget;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\PushTargetKind;
use GuzzleHttp\HandlerStack;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Psl\Json;
use Psl\Str;
use RuntimeException;
use SensitiveParameter;

/** Web Push with VAPID, through minishlink/web-push on bcmath. Its Guzzle client sets its own timeout, so the worker's goes in. */
final readonly class VapidWebPush implements PushServiceInterface
{
    /** Web Push allows a `Topic` of at most 32 URL-safe base64 characters. */
    private const int TOPIC_LENGTH = 32;

    public function __construct(
        private string $subject,
        private string $publicKey,
        #[SensitiveParameter]
        private string $privateKey,
        private int $timeout,
        private ?HandlerStack $handler = null,
    ) {
    }

    public function kind(): PushTargetKind
    {
        return PushTargetKind::Web;
    }

    public function push(PushTarget $target, RenderedNotification $notification, ?string $collapseKey): ?string
    {
        $report = $this->client()->sendOneNotification(
            Subscription::create([
                'endpoint' => $target->address,
                'keys' => ['p256dh' => $target->publicKey ?? '', 'auth' => $target->authSecret ?? ''],
                'contentEncoding' => 'aes128gcm',
            ]),
            Json\encode(['title' => $notification->subject, 'body' => $notification->body, 'place' => $notification->place]),
            null === $collapseKey ? [] : ['topic' => self::topic($collapseKey)],
        );

        if ($report->isSubscriptionExpired()) {
            return null;
        }

        $response = $report->getResponse();

        if ($report->isSuccess()) {
            return $response?->getHeaderLine('Location') ?: 'web';
        }

        // Not the report's reason: Guzzle's message quotes the endpoint.
        throw new RuntimeException(null === $response ? 'Web Push could not be reached.' : Str\format('Web Push answered %d.', $response->getStatusCode()));
    }

    /** Built per send: a missing key throws here, and a stack without one must still boot. */
    private function client(): WebPush
    {
        return new WebPush(
            ['VAPID' => ['subject' => $this->subject, 'publicKey' => $this->publicKey, 'privateKey' => $this->privateKey]],
            [],
            $this->timeout,
            null === $this->handler ? ['connect_timeout' => $this->timeout] : ['connect_timeout' => $this->timeout, 'handler' => $this->handler],
        );
    }

    private static function topic(string $collapseKey): string
    {
        return Str\slice(Str\trim_right(Str\replace_every(\base64_encode(\hash('sha256', $collapseKey, true)), ['+' => '-', '/' => '_']), '='), 0, self::TOPIC_LENGTH);
    }
}
