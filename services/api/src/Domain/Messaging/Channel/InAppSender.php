<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Channel;

use App\Domain\Messaging\Http\NotificationItemSerialiser;
use App\Domain\Messaging\Interfaces\ChannelSenderInterface;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Entity\NotificationItem;
use App\Entity\User;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Json;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** The bell (sc-3980). The item takes the delivery's id, so a retry after the hub refused writes nothing twice and publishes again. */
final readonly class InAppSender implements ChannelSenderInterface
{
    public function __construct(
        private Connection $connection,
        private EntityManagerInterface $entityManager,
        private RealtimePublisher $realtimePublisher,
        private ClockInterface $clock,
    ) {
    }

    public function channel(): NotificationChannel
    {
        return NotificationChannel::InApp;
    }

    public function send(Uuid $deliveryId, Recipient $recipient, NotificationCategory $category, RenderedNotification $notification, ?string $collapseKey = null): ?string
    {
        $delivery = Type\shape([
            'event_id' => Type\nullable(Type\string()),
            'event_name' => Type\nullable(Type\string()),
            'event_available' => Type\bool(),
            'muted' => Type\bool(),
        ])->coerce($this->connection->fetchAssociative(
            <<<'SQL'
                SELECT d.event_id, e.name AS event_name,
                       (e.deleted_at IS NULL AND o.deleted_at IS NULL) IS TRUE AS event_available,
                       EXISTS (SELECT 1 FROM event_mutes m WHERE m.event_id = d.event_id AND m.user_id = d.recipient_id) AS muted
                FROM notification_deliveries d
                LEFT JOIN events e ON e.id = d.event_id
                LEFT JOIN organisations o ON o.id = e.organisation_id
                WHERE d.id = :id
                SQL,
            ['id' => $deliveryId->toRfc4122()],
        ));

        $item = new NotificationItem(
            $deliveryId,
            Type\instance_of(User::class)->coerce($this->entityManager->getReference(User::class, $recipient->id)),
            $category,
            $notification->subject,
            $notification->lines,
            null === $delivery['event_id'] ? null : Uuid::fromString($delivery['event_id']),
            $delivery['event_name'],
            $notification->place,
            $delivery['muted'] && $category->heldByMute(),
            $this->clock->now(),
        );

        $this->connection->executeStatement(
            <<<'SQL'
                INSERT INTO notification_items (id, user_id, category, title, lines, event_id, event_name, place, muted, read_at, created_at)
                VALUES (:id, :user, :category, :title, :lines, :event, :eventName, :place, :muted, NULL, :createdAt)
                ON CONFLICT (id) DO NOTHING
                SQL,
            [
                'id' => $item->getId()->toRfc4122(),
                'user' => $recipient->id->toRfc4122(),
                'category' => $category->value,
                'title' => $item->getTitle(),
                'lines' => Json\encode($item->getLines()),
                'event' => $item->getEventId()?->toRfc4122(),
                'eventName' => $item->getEventName(),
                'place' => $item->getPlace(),
                'muted' => $item->isMuted(),
                'createdAt' => $item->getCreatedAt(),
            ],
            ['muted' => Types::BOOLEAN, 'createdAt' => Types::DATETIME_IMMUTABLE],
        );

        $this->realtimePublisher->publish(
            RealtimeTopic::UserNotifications,
            $recipient->id->toRfc4122(),
            NotificationItemSerialiser::item($item, $delivery['event_available']),
        );

        return null;
    }
}
