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

/** All guests, those chosen (sc-3942), or those matching every condition when it goes (sc-3957): the guests on the list, never a companion, who has no contact details of their own (sc-1468). */
final readonly class GuestAudienceResolver implements AudienceResolverInterface
{
    public function __construct(
        private Connection $connection,
        private GuestRepository $guestRepository,
    ) {
    }

    /**
     * @param list<string>                                 $chosen     only for those chosen
     * @param list<array{type: string, groupId?: ?string}> $conditions only for conditions
     */
    public static function audience(Uuid $eventId, string $choice, array $chosen, array $conditions = []): Audience
    {
        return Audience::guests($eventId, [
            'choice' => $choice,
            'guestIds' => GuestMessage::CHOSEN === $choice ? $chosen : [],
            ...GuestMessage::CONDITIONS === $choice ? ['conditions' => $conditions] : [],
        ]);
    }

    public function kind(): NotificationAudienceKind
    {
        return NotificationAudienceKind::Guest;
    }

    public function resolve(Audience $audience, ?Uuid $after, int $limit): array
    {
        $choice = $audience->conditions['choice'] ?? null;
        $chosen = self::chosen($audience);

        if ([] === $chosen && GuestMessage::CHOSEN === $choice) {
            return [];
        }

        [$matching, $parameters] = GuestMessage::CONDITIONS === $choice ? GuestConditions::where(self::conditions($audience)) : ['TRUE', []];
        $ids = $this->connection->fetchFirstColumn(
            <<<'SQL'
                SELECT g.id FROM guests g
                WHERE g.event_id = :event
                  AND g.host_id IS NULL
                  AND g.removed_at IS NULL
                  AND (:all OR g.id IN (:chosen))
                  AND (CAST(:after AS UUID) IS NULL OR g.id > CAST(:after AS UUID))
                  AND
                SQL . ' ' . $matching . ' ORDER BY g.id LIMIT :limit',
            [
                ...$parameters,
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

    /** @return list<array{type: string, groupId?: ?string}> */
    public static function conditions(Audience $audience): array
    {
        return Type\vec(Type\shape(['type' => Type\string(), 'groupId' => Type\optional(Type\nullable(Type\string()))]))->coerce($audience->conditions['conditions'] ?? []);
    }

    /** @return list<string> */
    private static function chosen(Audience $audience): array
    {
        return Type\vec(Type\string())->coerce($audience->conditions['guestIds'] ?? []);
    }
}
