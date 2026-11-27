<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\KitchenCopy;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<KitchenCopy> */
final class KitchenCopyRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, KitchenCopy::class);
    }

    /** @return list<KitchenCopy> newest first */
    public function findForEvent(Event $event): array
    {
        return Type\vec(Type\instance_of(KitchenCopy::class))->coerce($this->createQueryBuilder('copy')
            ->andWhere('copy.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('copy.recordedAt', 'DESC')
            ->addOrderBy('copy.id', 'DESC')
            ->getQuery()
            ->getResult());
    }

    public function findLatestForEvent(Event $event): ?KitchenCopy
    {
        return $this->findOneBy(['event' => $event], ['recordedAt' => 'DESC', 'id' => 'DESC']);
    }

    public function findOneInEvent(Event $event, string $id): ?KitchenCopy
    {
        if (!Uuid::isValid($id)) {
            return null;
        }

        return $this->findOneBy(['event' => $event, 'id' => Uuid::fromString($id)]);
    }

    public function anyForEvent(Event $event): bool
    {
        return false !== $this->getEntityManager()->getConnection()->fetchOne('SELECT 1 FROM kitchen_copies WHERE event_id = :event LIMIT 1', ['event' => $event->getId()->toRfc4122()]);
    }

    /**
     * An erased guest leaves every copy of their event (GDPR Art. 17): their rows go, a changes page's line for them becomes a count of one, and the counts stay as given.
     *
     * @param list<string> $guestIds
     */
    public function forget(Event $event, array $guestIds): void
    {
        if ([] === $guestIds) {
            return;
        }

        foreach (['allergic', 'people'] as $rows) {
            $this->getEntityManager()->getConnection()->executeStatement(<<<'SQL'
                UPDATE kitchen_copies
                   SET sheet = jsonb_set(sheet, ARRAY[:rows]::text[], COALESCE(
                           (SELECT jsonb_agg(person ORDER BY at)
                              FROM jsonb_array_elements(sheet -> :rows) WITH ORDINALITY AS rows (person, at)
                             WHERE (person ->> 'id') NOT IN (:ids)),
                           '[]'::jsonb))
                 WHERE event_id = :event
                   AND jsonb_typeof(sheet -> :rows) = 'array'
                SQL, ['rows' => $rows, 'event' => $event->getId()->toRfc4122(), 'ids' => $guestIds], ['ids' => ArrayParameterType::STRING]);
        }

        $this->getEntityManager()->getConnection()->executeStatement(<<<'SQL'
            UPDATE kitchen_copies
               SET sheet = jsonb_set(sheet, '{changes,lines}', COALESCE(
                       (SELECT jsonb_agg(CASE WHEN (line ->> 'guest') IN (:ids) THEN line || '{"guest": null, "who": null}'::jsonb ELSE line END ORDER BY at)
                          FROM jsonb_array_elements(sheet #> '{changes,lines}') WITH ORDINALITY AS lines (line, at)),
                       '[]'::jsonb))
             WHERE event_id = :event
               AND jsonb_typeof(sheet #> '{changes,lines}') = 'array'
            SQL, ['event' => $event->getId()->toRfc4122(), 'ids' => $guestIds], ['ids' => ArrayParameterType::STRING]);
    }
}
