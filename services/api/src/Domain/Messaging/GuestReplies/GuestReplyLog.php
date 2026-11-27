<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestReplies;

use App\Domain\Messaging\GuestReplies\Model\GuestChangeRow;
use App\Domain\Messaging\GuestReplies\Model\GuestReplyTally;
use App\Enum\GuestChangeKind;
use App\Enum\GuestReply;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** Reads an event's guest changes and when a member last looked at them (sc-4331), so the bell, the push, the summary and Changed since you looked count the same guests. */
final readonly class GuestReplyLog
{
    /** In the address, for a member who had never looked: every change counts. */
    public const string NEVER = 'all';

    private const string THREAD = 'guest-replies:';

    public function __construct(
        private Connection $connection,
    ) {
    }

    public static function thread(string $eventId): string
    {
        return self::THREAD . $eventId;
    }

    /** The guest list under Changed since you looked, counting from the look before this one; `all` for a member who has never looked (AC 2, AC 4). */
    public static function place(string $eventId, ?DateTimeImmutable $looked): string
    {
        return Str\format('/app/events/%s/guests?filter=changed&since=%s', $eventId, null === $looked ? self::NEVER : \rawurlencode($looked->format(\DATE_ATOM)));
    }

    /** @return ?string the event a Guest replies thread is about */
    public static function eventOf(?string $thread): ?string
    {
        return null !== $thread && Str\starts_with($thread, self::THREAD) ? Str\strip_prefix($thread, self::THREAD) : null;
    }

    public function lookedAt(Uuid $userId, string $eventId): ?DateTimeImmutable
    {
        $at = $this->connection->fetchOne(
            'SELECT looked_at FROM guest_reply_looks WHERE user_id = :user AND event_id = :event',
            ['user' => $userId->toRfc4122(), 'event' => $eventId],
        );

        return false === $at ? null : self::moment($at);
    }

    public function look(Uuid $userId, string $eventId, DateTimeImmutable $at): void
    {
        $this->connection->executeStatement(
            <<<'SQL'
                INSERT INTO guest_reply_looks (id, user_id, event_id, looked_at)
                SELECT :id, :user, :event, :at WHERE EXISTS (SELECT 1 FROM events WHERE id = :event)
                ON CONFLICT (user_id, event_id) DO UPDATE SET looked_at = EXCLUDED.looked_at
                SQL,
            ['id' => Uuid::v7()->toRfc4122(), 'user' => $userId->toRfc4122(), 'event' => $eventId, 'at' => $at],
            ['at' => Types::DATETIME_IMMUTABLE],
        );
    }

    /** What the member has not looked at: every change from their last look on, or every change when they never have. */
    public function unseen(Uuid $userId, string $eventId): GuestReplyTally
    {
        return $this->after($eventId, $this->lookedAt($userId, $eventId));
    }

    /**
     * One row per guest still on the list, newest first, for the changes from the moment given on (or every change, for none). Times are kept to the second, so a change in the same second as a look counts again rather than never.
     */
    public function after(string $eventId, ?DateTimeImmutable $after): GuestReplyTally
    {
        $rows = $this->connection->fetchAllAssociative(
            <<<'SQL'
                SELECT c.guest_id, COALESCE(g.full_name, '') AS name, c.kind, g.reply, c.created_at
                FROM guest_reply_changes c
                JOIN guests g ON g.id = c.guest_id
                WHERE c.event_id = :event AND g.removed_at IS NULL AND (CAST(:after AS TIMESTAMP) IS NULL OR c.created_at >= :after)
                ORDER BY c.created_at, c.id
                SQL,
            ['event' => $eventId, 'after' => $after],
            ['after' => Types::DATETIME_IMMUTABLE],
        );

        $guests = [];

        foreach ($rows as $row) {
            $id = Type\string()->coerce($row['guest_id']);
            $kind = GuestChangeKind::from(Type\string()->coerce($row['kind']));
            $at = self::moment($row['created_at']);
            $was = $guests[$id] ?? null;
            $guests[$id] = new GuestChangeRow(
                $id,
                Type\string()->coerce($row['name']),
                match (true) {
                    null === $was => $kind,
                    $was->kind->isReply() => $was->kind,
                    $kind->isReply() => $kind,
                    default => $kind,
                },
                GuestReply::tryFrom(Type\string()->coerce($row['reply'] ?? '')),
                $at,
            );
        }

        return new GuestReplyTally(Vec\reverse(Vec\sort_by(Vec\values($guests), static fn (GuestChangeRow $row): int => $row->at->getTimestamp())));
    }

    private static function moment(mixed $stored): DateTimeImmutable
    {
        return new DateTimeImmutable(Type\string()->coerce($stored), new DateTimeZone('UTC'));
    }
}
