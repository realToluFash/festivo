<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Entity\User;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Symfony\Component\Uid\Uuid;

/** One switch in Notification settings. The row is kept when it matches the default, so a later change to a default leaves a member's choice alone. */
final readonly class NotificationPreferenceSetter
{
    public function __construct(
        private Connection $connection,
    ) {
    }

    public function set(User $user, NotificationCategory $category, NotificationChannel $channel, bool $on): void
    {
        $this->connection->executeStatement(
            <<<'SQL'
                INSERT INTO notification_preferences (id, user_id, category, channel, allowed)
                VALUES (:id, :user, :category, :channel, :allowed)
                ON CONFLICT (user_id, category, channel) DO UPDATE SET allowed = EXCLUDED.allowed
                SQL,
            [
                'id' => Uuid::v7()->toRfc4122(),
                'user' => $user->getId()->toRfc4122(),
                'category' => $category->value,
                'channel' => $channel->value,
                'allowed' => $on,
            ],
            ['allowed' => Types::BOOLEAN],
        );
    }
}
