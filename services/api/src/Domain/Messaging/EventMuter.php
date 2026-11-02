<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Entity\Event;
use App\Entity\User;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** Mute this event, on or off. It applies to what is fanned out from now; deliveries already written go as they were. */
final readonly class EventMuter
{
    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
    ) {
    }

    public function set(User $user, Event $event, bool $muted): void
    {
        $person = ['user' => $user->getId()->toRfc4122(), 'event' => $event->getId()->toRfc4122()];

        if (!$muted) {
            $this->connection->executeStatement('DELETE FROM event_mutes WHERE user_id = :user AND event_id = :event', $person);

            return;
        }

        $this->connection->executeStatement(
            <<<'SQL'
                INSERT INTO event_mutes (id, user_id, event_id, muted_at)
                VALUES (:id, :user, :event, :now)
                ON CONFLICT (user_id, event_id) DO NOTHING
                SQL,
            [...$person, 'id' => Uuid::v7()->toRfc4122(), 'now' => $this->clock->now()],
            ['now' => Types::DATETIME_IMMUTABLE],
        );
    }
}
