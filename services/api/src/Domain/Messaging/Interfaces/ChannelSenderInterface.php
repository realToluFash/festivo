<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Interfaces;

use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;
use Symfony\Component\Uid\Uuid;
use Throwable;

/** Every call it makes to a provider must end within the worker's limit, whatever timeout the provider's own client sets (docs/architecture/notifications.md). */
#[AutoconfigureTag(self::TAG)]
interface ChannelSenderInterface
{
    public const string TAG = 'app.notification_channel_sender';

    public function channel(): NotificationChannel;

    /**
     * @param Uuid $deliveryId passed to the provider as its idempotency key, where it takes one
     *
     * @return ?string the provider's id for the message
     *
     * @throws Throwable whose message is recorded as the provider's reason
     */
    public function send(Uuid $deliveryId, Recipient $recipient, NotificationCategory $category, RenderedNotification $notification): ?string;
}
