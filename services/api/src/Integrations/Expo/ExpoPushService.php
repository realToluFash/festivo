<?php

declare(strict_types=1);

namespace App\Integrations\Expo;

use App\Domain\Messaging\Interfaces\PushServiceInterface;
use App\Domain\Messaging\Model\PushTarget;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationCategory;
use App\Enum\PushTargetKind;
use Psl\Dict;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use RuntimeException;
use SensitiveParameter;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/** The Expo push service; receipts are not polled, since no story runs its own sweep. `tag` replaces a shown notification on Android, as `collapseId` does on iOS. */
final readonly class ExpoPushService implements PushServiceInterface
{
    public function __construct(
        private HttpClientInterface $http,
        private string $apiBase,
        #[SensitiveParameter]
        private string $accessToken,
        private float $timeout,
    ) {
    }

    public function kind(): PushTargetKind
    {
        return PushTargetKind::Expo;
    }

    public function push(PushTarget $target, NotificationCategory $category, RenderedNotification $notification, ?string $collapseKey): ?string
    {
        $message = Dict\filter_nulls([
            'to' => $target->address,
            'title' => $notification->subject,
            'body' => $notification->body,
            // The app drops a tap on a push sent to somebody else who signed out on this phone.
            'data' => ['place' => $notification->place, 'recipient' => $target->userId],
            'collapseId' => $collapseKey,
            'threadId' => $collapseKey,
            'tag' => $collapseKey,
            // The app makes the event_day channel; every other push takes Android's default.
            'channelId' => NotificationCategory::EventDay === $category ? $category->value : null,
            'interruptionLevel' => NotificationCategory::EventDay === $category ? 'time-sensitive' : null,
        ]);

        try {
            $response = $this->http->request('POST', Str\trim_right($this->apiBase, '/') . '/--/api/v2/push/send', [
                'json' => [$message],
                'headers' => '' === $this->accessToken ? [] : ['Authorization' => 'Bearer ' . $this->accessToken],
                'timeout' => $this->timeout,
                'max_duration' => $this->timeout,
            ]);
            $status = $response->getStatusCode();
            $content = $response->getContent(false);
        } catch (TransportExceptionInterface) {
            throw new RuntimeException('The Expo push service could not be reached.');
        }

        if ($status >= 300) {
            throw new RuntimeException(Str\format('The Expo push service answered %d.', $status));
        }

        // A ticket's message quotes the token, so only its status and error code are read.
        try {
            $ticket = Type\shape(['data' => Type\shape([0 => Type\shape([
                'status' => Type\string(),
                'id' => Type\optional(Type\string()),
                'details' => Type\optional(Type\shape(['error' => Type\optional(Type\string())], true)),
            ], true)], true)], true)->coerce(Json\decode($content))['data'][0];
        } catch (Json\Exception\DecodeException|Type\Exception\CoercionException) {
            throw new RuntimeException('The Expo push service answered without a ticket.');
        }

        if ('ok' === $ticket['status']) {
            return $ticket['id'] ?? 'expo';
        }

        $error = $ticket['details']['error'] ?? 'an unnamed error';

        if ('DeviceNotRegistered' === $error) {
            return null;
        }

        throw new RuntimeException(Str\format('The Expo push service answered %s.', $error));
    }
}
