<?php

declare(strict_types=1);

namespace App\Tests\Double\Messaging;

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
}
