<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Entity\NotificationItem;
use App\Entity\User;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/** Opening an item and Mark all read (sc-3980). Reading an item twice keeps the first time it was read. */
final readonly class NotificationReadMarker
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private Connection $connection,
        private ClockInterface $clock,
    ) {
    }

    public function markRead(NotificationItem $item): void
    {
        if (null !== $item->getReadAt()) {
            return;
        }

        $item->setReadAt($this->clock->now());
        $this->entityManager->flush();
    }

    public function markAllRead(User $user): void
    {
        $this->connection->executeStatement(
            'UPDATE notification_items SET read_at = :now WHERE user_id = :user AND read_at IS NULL',
            ['now' => $this->clock->now(), 'user' => $user->getId()->toRfc4122()],
            ['now' => Types::DATETIME_IMMUTABLE],
        );
    }
}
