<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Channel;

use App\Domain\Messaging\Http\NotificationItemSerialiser;
use App\Domain\Messaging\Interfaces\ChannelSenderInterface;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Domain\Messaging\NotificationItemPruner;
use App\Entity\NotificationItem;
use App\Entity\User;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;
use App\Repository\NotificationItemRepository;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Json;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** The bell (sc-3980). The item takes the delivery's id, so a retry after the hub refused writes nothing twice and publishes again; every publish carries the count a reload would show (sc-21785). */
final readonly class InAppSender implements ChannelSenderInterface
{
    public function __construct(
        private Connection $connection,
        private EntityManagerInterface $entityManager,
        private RealtimePublisher $realtimePublisher,
        private ClockInterface $clock,
        private NotificationItemRepository $notificationItemRepository,
        private NotificationItemPruner $notificationItemPruner,
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

        if (null !== $notification->thread && '' === $notification->subject) {
            $this->removeUnread($recipient, $notification->thread);

            return null;
        }

        if (null !== $notification->thread && $notification->quiet) {
            $rewritten = $this->connection->fetchOne(
                'UPDATE notification_items SET category = :category, title = :title, lines = :lines, muted = :muted WHERE user_id = :user AND thread = :thread AND read_at IS NULL RETURNING id',
                ['category' => $category->value, 'title' => $notification->subject, 'lines' => Json\encode($notification->lines), 'muted' => $delivery['muted'] && $category->heldByMute(), 'user' => $recipient->id->toRfc4122(), 'thread' => $notification->thread],
                ['muted' => Types::BOOLEAN],
            );

            if (false !== $rewritten) {
                $this->publishRewrite($recipient, Type\string()->coerce($rewritten), $delivery['event_available']);
            }

            return null;
        }

        $item = new NotificationItem(
            $deliveryId,
            $this->user($recipient),
            $category,
            $notification->subject,
            $notification->lines,
            null === $delivery['event_id'] ? null : Uuid::fromString($delivery['event_id']),
            $delivery['event_name'],
            $notification->place,
            $delivery['muted'] && $category->heldByMute(),
            $this->clock->now(),
        );

        $params = [
            'id' => $item->getId()->toRfc4122(),
            'user' => $recipient->id->toRfc4122(),
            'category' => $category->value,
            'title' => $item->getTitle(),
            'lines' => Json\encode($item->getLines()),
            'event' => $item->getEventId()?->toRfc4122(),
            'eventName' => $item->getEventName(),
            'place' => $item->getPlace(),
            'muted' => $item->isMuted(),
            'thread' => $notification->thread,
            'threadFrom' => $notification->threadFrom,
            'createdAt' => $item->getCreatedAt(),
        ];
        $types = ['muted' => Types::BOOLEAN, 'createdAt' => Types::DATETIME_IMMUTABLE];
        $written = null !== $notification->thread && $notification->reopens ? $this->reopen($recipient, $params, $types) : false;
        $written = false !== $written ? $written : $this->insert($notification->thread, $params, $types);

        $published = NotificationItemSerialiser::item($item, $delivery['event_available']);

        if (false !== $written) {
            $published['id'] = $written;
        }

        $published['unreadCount'] = $this->unreadFor($recipient);
        $this->realtimePublisher->publishOrFail(RealtimeTopic::UserNotifications, $recipient->id->toRfc4122(), $published);

        return null;
    }

    /**
     * A thread's unread item takes the new words and rises to the top, keeping its id; a retry of the delivery that began it lands there too.
     *
     * @param array<string, mixed>  $params
     * @param array<string, string> $types
     */
    private function insert(?string $thread, array $params, array $types): string|false
    {
        $written = $this->connection->fetchOne(
            null === $thread
                ? <<<'SQL'
                    INSERT INTO notification_items (id, user_id, category, title, lines, event_id, event_name, place, muted, read_at, thread, thread_from, created_at)
                    VALUES (:id, :user, :category, :title, :lines, :event, :eventName, :place, :muted, NULL, NULL, NULL, :createdAt)
                    ON CONFLICT (id) DO NOTHING
                    RETURNING id
                    SQL
                : <<<'SQL'
                    INSERT INTO notification_items (id, user_id, category, title, lines, event_id, event_name, place, muted, read_at, thread, thread_from, created_at)
                    SELECT :id, :user, :category, :title, :lines, :event, :eventName, :place, :muted, NULL, :thread, :threadFrom, :createdAt
                    WHERE NOT EXISTS (SELECT 1 FROM notification_items WHERE id = :id)
                    ON CONFLICT (user_id, thread) WHERE ((read_at IS NULL) AND (thread IS NOT NULL))
                    DO UPDATE SET category = EXCLUDED.category, title = EXCLUDED.title, lines = EXCLUDED.lines, event_name = EXCLUDED.event_name,
                                  place = EXCLUDED.place, muted = EXCLUDED.muted, created_at = EXCLUDED.created_at
                    RETURNING id
                    SQL,
            $params,
            $types,
        );

        return false === $written ? false : Type\string()->coerce($written);
    }

    /**
     * The member's item in the thread, unread first, else the latest read one, takes the new words, turns unread and rises to the top; any other item in the thread goes, so the bell keeps one (sc-4331).
     *
     * @param array<string, mixed>  $params
     * @param array<string, string> $types
     */
    private function reopen(Recipient $recipient, array $params, array $types): string|false
    {
        $kept = $this->connection->fetchOne(
            <<<'SQL'
                UPDATE notification_items
                SET read_at = NULL, category = :category, title = :title, lines = :lines, event_name = :eventName,
                    place = :place, muted = :muted, created_at = :createdAt
                WHERE id = (
                    SELECT id FROM notification_items WHERE user_id = :user AND thread = :thread
                    ORDER BY read_at IS NOT NULL, created_at DESC, id DESC LIMIT 1
                )
                RETURNING id
                SQL,
            $params,
            $types,
        );

        if (false === $kept) {
            return false;
        }

        $kept = Type\string()->coerce($kept);
        $removed = $this->connection->fetchFirstColumn(
            'DELETE FROM notification_items WHERE user_id = :user AND thread = :thread AND id <> :kept RETURNING id',
            ['user' => $params['user'], 'thread' => $params['thread'], 'kept' => $kept],
        );

        if ([] !== $removed) {
            $unread = $this->unreadFor($recipient);

            foreach ($removed as $id) {
                $this->realtimePublisher->publish(RealtimeTopic::UserNotifications, $recipient->id->toRfc4122(), ['removedId' => Type\string()->coerce($id), 'unreadCount' => $unread]);
            }
        }

        return $kept;
    }

    /** An unread item left with nothing in it disappears (sc-13214, AC 3), and the member's bells drop it. */
    private function removeUnread(Recipient $recipient, string $thread): void
    {
        $removed = $this->connection->fetchOne(
            'DELETE FROM notification_items WHERE user_id = :user AND thread = :thread AND read_at IS NULL RETURNING id',
            ['user' => $recipient->id->toRfc4122(), 'thread' => $thread],
        );

        if (false === $removed) {
            return;
        }

        $unread = $this->unreadFor($recipient);
        $this->realtimePublisher->publishOrFail(RealtimeTopic::UserNotifications, $recipient->id->toRfc4122(), [
            'removedId' => Type\string()->coerce($removed),
            'unreadCount' => $unread,
        ]);
    }

    /** The member made this change, so their bells swap the item in where it sits, announcing nothing (sc-21643). */
    private function publishRewrite(Recipient $recipient, string $id, bool $eventAvailable): void
    {
        $item = Type\instance_of(NotificationItem::class)->coerce($this->notificationItemRepository->find($id));
        $this->entityManager->refresh($item);

        $unread = $this->unreadFor($recipient);
        $this->realtimePublisher->publishOrFail(RealtimeTopic::UserNotifications, $recipient->id->toRfc4122(), [
            'updated' => NotificationItemSerialiser::item($item, $eventAvailable),
            'unreadCount' => $unread,
        ]);
    }

    private function unreadFor(Recipient $recipient): int
    {
        return $this->notificationItemRepository->countUnreadFor($this->user($recipient), $this->notificationItemPruner->keptSince());
    }

    private function user(Recipient $recipient): User
    {
        return Type\instance_of(User::class)->coerce($this->entityManager->getReference(User::class, $recipient->id));
    }
}
