<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Http;

use App\Entity\NotificationItem;
use App\Entity\User;
use App\Enum\NotificationCategory;
use App\Repository\EventMuteRepository;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;

/** The bell's item shape (sc-3980 Design, #7475 and #13415): the client derives nothing, so `muted` and `eventAvailable` are answered here. */
final readonly class NotificationItemSerialiser
{
    public function __construct(
        private EventMuteRepository $eventMuteRepository,
        private Connection $connection,
    ) {
    }

    /**
     * @param list<NotificationItem> $items all the same member's
     *
     * @return list<array{id: string, category: string, title: string, lines: list<string>, eventId: ?string, eventName: ?string, eventAvailable: bool, muted: bool, place: ?string, read: bool, createdAt: string}>
     */
    public function items(User $user, array $items): array
    {
        $eventIds = Vec\unique(Vec\filter_nulls(Vec\map($items, static fn (NotificationItem $item): ?string => $item->getEventId()?->toRfc4122())));
        $muted = [] === $eventIds ? [] : $this->eventMuteRepository->findMutedEventIds($user);
        $available = $this->availableEvents($eventIds);

        return Vec\map($items, static fn (NotificationItem $item): array => self::item(
            $item,
            Iter\contains($muted, $item->getEventId()?->toRfc4122()),
            Iter\contains($available, $item->getEventId()?->toRfc4122()),
        ));
    }

    /** @return array{id: string, category: string, title: string, lines: list<string>, eventId: ?string, eventName: ?string, eventAvailable: bool, muted: bool, place: ?string, read: bool, createdAt: string} */
    public static function item(NotificationItem $item, bool $eventMuted, bool $eventAvailable): array
    {
        return [
            'id' => $item->getId()->toRfc4122(),
            'category' => $item->getCategory()->value,
            'title' => $item->getTitle(),
            'lines' => $item->getLines(),
            'eventId' => $item->getEventId()?->toRfc4122(),
            'eventName' => $item->getEventName(),
            'eventAvailable' => null !== $item->getEventId() && $eventAvailable,
            // Event day still pushes when muted, so nothing was held back and there is nothing to mark.
            'muted' => $eventMuted && !Iter\contains([NotificationCategory::EventDay, NotificationCategory::AccountSecurity], $item->getCategory()),
            'place' => $item->getPlace(),
            'read' => null !== $item->getReadAt(),
            'createdAt' => $item->getCreatedAt()->format(\DATE_ATOM),
        ];
    }

    /**
     * @param list<string> $eventIds
     *
     * @return list<string> those still there: not deleted, nor their organisation
     */
    private function availableEvents(array $eventIds): array
    {
        if ([] === $eventIds) {
            return [];
        }

        return Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
            <<<'SQL'
                SELECT e.id FROM events e
                JOIN organisations o ON o.id = e.organisation_id
                WHERE e.id IN (:ids) AND e.deleted_at IS NULL AND o.deleted_at IS NULL
                SQL,
            ['ids' => $eventIds],
            ['ids' => ArrayParameterType::STRING],
        ));
    }
}
