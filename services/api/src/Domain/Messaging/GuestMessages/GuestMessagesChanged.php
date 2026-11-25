<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;
use Doctrine\DBAL\Connection;
use Psl\Type;

/** Tells an event's Messages to ask again (sc-3942) when a message goes or one of its deliveries changes; the signal carries nothing, so no address reaches a member without guests.manage. */
final readonly class GuestMessagesChanged
{
    public function __construct(
        private Connection $connection,
        private RealtimePublisher $realtimePublisher,
    ) {
    }

    public function onEvent(string $eventId): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventMessages, $eventId, []);
    }

    /** A delivery of any other notification changes nothing here. */
    public function afterDelivery(string $deliveryId): void
    {
        $eventId = $this->connection->fetchOne(
            'SELECT event_id FROM notification_deliveries WHERE id = :id AND type = :type',
            ['id' => $deliveryId, 'type' => GuestMessageNotice::NAME],
        );

        if (\is_string($eventId)) {
            $this->onEvent(Type\string()->coerce($eventId));
        }
    }
}
