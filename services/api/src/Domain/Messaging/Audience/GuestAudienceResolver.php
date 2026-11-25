<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Audience;

use App\Domain\Messaging\Interfaces\AudienceResolverInterface;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Recipient;
use App\Entity\GuestMessage;
use App\Enum\NotificationAudienceKind;
use App\Repository\GuestRepository;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** All guests, or those chosen (sc-3942): the guests on the list, never a companion, who has no contact details of their own (sc-1468). sc-3957 adds its conditions here. */
final readonly class GuestAudienceResolver implements AudienceResolverInterface
{
    public function __construct(
        private Connection $connection,
        private GuestRepository $guestRepository,
    ) {
    }

    /** @param list<string> $chosen ignored for all guests */
    public static function audience(Uuid $eventId, string $choice, array $chosen): Audience
    {
        return Audience::guests($eventId, ['choice' => $choice, 'guestIds' => GuestMessage::ALL === $choice ? [] : $chosen]);
    }

    public function kind(): NotificationAudienceKind
    {
        return NotificationAudienceKind::Guest;
    }

    public function resolve(Audience $audience, ?Uuid $after, int $limit): array
    {
        $chosen = self::chosen($audience);

        if ([] === $chosen && GuestMessage::CHOSEN === ($audience->conditions['choice'] ?? null)) {
            return [];
        }

        $ids = $this->connection->fetchFirstColumn(
            <<<'SQL'
                SELECT id FROM guests
                WHERE event_id = :event
                  AND host_id IS NULL
                  AND removed_at IS NULL
                  AND (:all OR id IN (:chosen))
                  AND (CAST(:after AS UUID) IS NULL OR id > CAST(:after AS UUID))
                ORDER BY id
                LIMIT :limit
                SQL,
            [
                'event' => self::eventId($audience),
                'all' => [] === $chosen,
                'chosen' => [] === $chosen ? [Uuid::v7()->toRfc4122()] : $chosen,
                'after' => $after?->toRfc4122(),
                'limit' => $limit,
            ],
            ['all' => 'boolean', 'chosen' => ArrayParameterType::STRING, 'limit' => 'integer'],
        );

        return Vec\map(Type\vec(Type\string())->coerce($ids), Uuid::fromString(...));
    }

    public function recipient(Audience $audience, Uuid $id): ?Recipient
    {
        $guest = $this->guestRepository->findOneInEvent(Uuid::fromString(self::eventId($audience)), $id);

        if (null === $guest || null !== $guest->getHost()) {
            return null;
        }

        $locale = $guest->getChosenLanguage() ?? $guest->getLanguage() ?? $guest->getEvent()->getOrganisation()->getLocale();

        return new Recipient(NotificationAudienceKind::Guest, $id, $guest->getFullName() ?? '', $locale, $guest->getEmail());
    }

    private static function eventId(Audience $audience): string
    {
        return Type\string()->coerce($audience->conditions['eventId'] ?? null);
    }

    /** @return list<string> */
    private static function chosen(Audience $audience): array
    {
        return Type\vec(Type\string())->coerce($audience->conditions['guestIds'] ?? []);
    }
}
