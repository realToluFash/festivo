<?php

declare(strict_types=1);

namespace App\Tests\Double\Messaging;

use App\Domain\Messaging\Command\WorkNotificationsCommand;
use App\Domain\Messaging\Interfaces\ChannelSenderInterface;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use RuntimeException;
use Symfony\Component\Uid\Uuid;

/** The email channel in the suite: keeps what would have gone, and fails when told to. */
final class RecordingEmailSender implements ChannelSenderInterface
{
    /** Set only for a worker in its own process: the test sees the call begin, and answers it when it chooses. */
    public const string GATE = 'NOTIFICATION_PROVIDER_GATE';

    /** @var list<array{delivery: string, recipient: Recipient, notification: RenderedNotification}> */
    public array $sent = [];

    public int $calls = 0;

    public int $failuresLeft = 0;

    /** A real sender to hand each send to, for a test about what a provider does. */
    public ?ChannelSenderInterface $through = null;

    public function channel(): NotificationChannel
    {
        return NotificationChannel::Email;
    }

    public function send(Uuid $deliveryId, Recipient $recipient, NotificationCategory $category, RenderedNotification $notification): ?string
    {
        ++$this->calls;
        $gate = \getenv(self::GATE);

        if (\is_string($gate)) {
            self::awaitAnswer($gate);
        }

        if ($this->failuresLeft > 0) {
            --$this->failuresLeft;

            throw new RuntimeException('550 the provider said no');
        }

        if (null !== $this->through) {
            return $this->through->send($deliveryId, $recipient, $category, $notification);
        }

        $this->sent[] = ['delivery' => $deliveryId->toRfc4122(), 'recipient' => $recipient, 'notification' => $notification];

        return 'provider-' . $deliveryId->toRfc4122();
    }

    /** Answered within the worker's socket limit, as a provider that accepts the message slowly would be. */
    private static function awaitAnswer(string $gate): void
    {
        \touch($gate . '.called');
        $until = \microtime(true) + (float) WorkNotificationsCommand::SOCKET_TIMEOUT;

        while (!\file_exists($gate . '.answer')) {
            if (\microtime(true) >= $until) {
                \touch($gate . '.gave-up');

                throw new RuntimeException('the provider did not answer');
            }

            // @mago-expect lint:psl-sleep-functions Async\sleep waits in an event loop, where SIGTERM is not seen until it returns
            \usleep(20_000);
            \clearstatcache();
        }
    }
}
