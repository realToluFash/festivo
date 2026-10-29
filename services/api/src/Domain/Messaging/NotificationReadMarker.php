<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Entity\NotificationItem;
use App\Entity\User;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;
use App\Repository\NotificationItemRepository;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/** Opening an item and Mark all read (sc-3980), published with the count left so the member's other bells follow. */
final readonly class NotificationReadMarker
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private Connection $connection,
        private ClockInterface $clock,
        private NotificationItemRepository $notificationItemRepository,
        private NotificationItemPruner $notificationItemPruner,
        private RealtimePublisher $realtimePublisher,
    ) {
    }

    public function markRead(User $user, NotificationItem $item): int
    {
        if (null !== $item->getReadAt()) {
            return $this->unread($user);
        }

        $item->setReadAt($this->clock->now());
        $this->entityManager->flush();

        return $this->published($user, ['readId' => $item->getId()->toRfc4122()]);
    }

    public function markAllRead(User $user): int
    {
        $this->connection->executeStatement(
            'UPDATE notification_items SET read_at = :now WHERE user_id = :user AND read_at IS NULL',
            ['now' => $this->clock->now(), 'user' => $user->getId()->toRfc4122()],
            ['now' => Types::DATETIME_IMMUTABLE],
        );

        return $this->published($user, ['readAll' => true]);
    }

    /** @param array<string, mixed> $read */
    private function published(User $user, array $read): int
    {
        $unread = $this->unread($user);
        $this->realtimePublisher->publish(RealtimeTopic::UserNotifications, $user->getId()->toRfc4122(), [...$read, 'unreadCount' => $unread]);

        return $unread;
    }

    private function unread(User $user): int
    {
        return $this->notificationItemRepository->countUnreadFor($user, $this->notificationItemPruner->keptSince());
    }
}
