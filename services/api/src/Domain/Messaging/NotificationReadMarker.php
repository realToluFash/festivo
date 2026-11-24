<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Messaging\GuestReplies\GuestReplyLog;
use App\Entity\NotificationItem;
use App\Entity\User;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;
use App\Repository\NotificationItemRepository;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Psr\Clock\ClockInterface;

/** Opening an item and Mark all read (sc-3980), published with the count left so the member's other bells follow. Reading a Guest replies item is the member's look at that event's guests (sc-4331). */
final readonly class NotificationReadMarker
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private Connection $connection,
        private ClockInterface $clock,
        private NotificationItemRepository $notificationItemRepository,
        private NotificationItemPruner $notificationItemPruner,
        private RealtimePublisher $realtimePublisher,
        private GuestReplyLog $guestReplyLog,
    ) {
    }

    public function markRead(User $user, NotificationItem $item): int
    {
        if (null !== $item->getReadAt()) {
            return $this->unread($user);
        }

        $now = $this->clock->now();
        $item->setReadAt($now);
        $this->entityManager->flush();
        $eventId = GuestReplyLog::eventOf($item->getThread());

        if (null !== $eventId) {
            $this->guestReplyLog->look($user->getId(), $eventId, $now);
        }

        return $this->published($user, ['readId' => $item->getId()->toRfc4122()]);
    }

    public function markAllRead(User $user): int
    {
        $now = $this->clock->now();
        $threads = $this->connection->fetchFirstColumn(
            'UPDATE notification_items SET read_at = :now WHERE user_id = :user AND read_at IS NULL RETURNING thread',
            ['now' => $now, 'user' => $user->getId()->toRfc4122()],
            ['now' => Types::DATETIME_IMMUTABLE],
        );

        foreach ($threads as $thread) {
            $eventId = GuestReplyLog::eventOf(Type\nullable(Type\string())->coerce($thread));

            if (null !== $eventId) {
                $this->guestReplyLog->look($user->getId(), $eventId, $now);
            }
        }

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
