<?php

declare(strict_types=1);

namespace App\Tests\Double\Messaging;

use App\Domain\Messaging\Interfaces\ChannelSenderInterface;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use Symfony\Component\Uid\Uuid;

/** The push channel in the suite: keeps what would have gone to the member's devices. */
final class RecordingPushSender implements ChannelSenderInterface
{
    /** @var list<array{delivery: string, recipient: Recipient, category: NotificationCategory, notification: RenderedNotification}> */
    public array $sent = [];

    public function channel(): NotificationChannel
    {
        return NotificationChannel::Push;
    }

    public function send(Uuid $deliveryId, Recipient $recipient, NotificationCategory $category, RenderedNotification $notification, ?string $collapseKey = null): ?string
    {
        $this->sent[] = ['delivery' => $deliveryId->toRfc4122(), 'recipient' => $recipient, 'category' => $category, 'notification' => $notification];

        return 'push-' . $deliveryId->toRfc4122();
    }
}
