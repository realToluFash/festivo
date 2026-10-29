<?php

declare(strict_types=1);

namespace App\Domain\Messaging\EventChanges;

use App\Domain\Messaging\Model\EventChangeEntry;
use App\Enum\EventChangeKind;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** Reads an event's changes and the bell item a member is reading them in, past the soft-delete filter so a deleted event still tells. */
final readonly class EventChangeLog
{
    public function __construct(
        private Connection $connection,
    ) {
    }

    public static function thread(string $eventId): string
    {
        return 'event-changes:' . $eventId;
    }

    /** @return list<EventChangeEntry> oldest first, from the one given on */
    public function since(string $eventId, string $fromChangeId): array
    {
        $rows = $this->connection->fetchAllAssociative(
            <<<'SQL'
                SELECT id, actor_id, actor_name, kind, fields, event_day, restorable_until, created_at
                FROM event_changes
                WHERE event_id = :event AND id >= :from
                ORDER BY id
                SQL,
            ['event' => $eventId, 'from' => $fromChangeId],
        );

        return Vec\map($rows, static fn (array $row): EventChangeEntry => new EventChangeEntry(
            Type\string()->coerce($row['id']),
            Type\nullable(Type\string())->coerce($row['actor_id']),
            Type\nullable(Type\string())->coerce($row['actor_name']),
            EventChangeKind::from(Type\string()->coerce($row['kind'])),
            Json\typed(Type\string()->coerce($row['fields']), Type\dict(Type\string(), Type\shape([0 => Type\mixed(), 1 => Type\mixed()]))),
            Type\bool()->coerce($row['event_day']),
            self::moment($row['created_at']) ?? new DateTimeImmutable(),
            self::moment($row['restorable_until']),
        ));
    }

    /** @return ?string the change the member's unread item for the event began with */
    public function unreadFrom(Uuid $userId, string $eventId): ?string
    {
        $from = $this->connection->fetchOne(
            'SELECT thread_from FROM notification_items WHERE user_id = :user AND thread = :thread AND read_at IS NULL',
            ['user' => $userId->toRfc4122(), 'thread' => self::thread($eventId)],
        );

        return false === $from ? null : Type\nullable(Type\string())->coerce($from);
    }

    /** @return array{event: string, organisation: string} */
    public function names(string $eventId): array
    {
        $row = $this->connection->fetchAssociative(
            'SELECT e.name AS event, o.name AS organisation FROM events e JOIN organisations o ON o.id = e.organisation_id WHERE e.id = :id',
            ['id' => $eventId],
        );

        return Type\shape(['event' => Type\string(), 'organisation' => Type\string()])->coerce(false === $row ? ['event' => '', 'organisation' => ''] : $row);
    }

    private static function moment(mixed $stored): ?DateTimeImmutable
    {
        return null === $stored ? null : new DateTimeImmutable(Type\string()->coerce($stored), new DateTimeZone('UTC'));
    }
}
