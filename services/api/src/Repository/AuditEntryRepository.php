<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\AuditEntry;
use App\Enum\AuditType;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<AuditEntry> */
final class AuditEntryRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AuditEntry::class);
    }

    /** @return list<AuditEntry> newest first */
    public function findLatest(string $subjectType, Uuid $subjectId, string $action, int $limit): array
    {
        return $this->findBy(
            ['subjectType' => $subjectType, 'subjectId' => $subjectId, 'action' => $action],
            ['occurredAt' => 'DESC', 'id' => 'DESC'],
            $limit,
        );
    }

    /**
     * @param ?array{0: DateTimeImmutable, 1: Uuid} $after the last entry of the page before
     *
     * @return list<AuditEntry> newest first
     */
    public function findPage(AuditFilter $filter, ?array $after, int $limit): array
    {
        $query = $this->filtered($filter)
            ->orderBy('a.occurredAt', 'DESC')
            ->addOrderBy('a.id', 'DESC')
            ->setMaxResults($limit);

        if (null !== $after) {
            $query->andWhere('a.occurredAt < :at OR (a.occurredAt = :at AND a.id < :id)')
                ->setParameter('at', $after[0])
                ->setParameter('id', $after[1], 'uuid');
        }

        return Type\vec(Type\instance_of(AuditEntry::class))->coerce($query->getQuery()->getResult());
    }

    public function countMatching(AuditFilter $filter): int
    {
        return Type\int()->coerce($this->filtered($filter)->select('COUNT(a.id)')->getQuery()->getSingleScalarResult());
    }

    /** @return list<array{id: string, name: string}> each person who did something in the log, under the name they last did it by */
    public function findPeople(AuditFilter $filter): array
    {
        return Type\vec(Type\shape(['id' => Type\string(), 'name' => Type\string()]))->coerce($this->getEntityManager()->getConnection()->fetchAllAssociative(<<<'SQL'
            SELECT DISTINCT ON (actor_id) actor_id::text AS id, COALESCE(actor_label, '') AS name
            FROM   audit_entries
            WHERE  organisation_id = :organisation
              AND  occurred_at >= :since
              AND  actor_type = 'user'
              AND  actor_id IS NOT NULL
              AND  action IN (:actions)
            ORDER  BY actor_id, occurred_at DESC
            SQL, $this->menuParameters($filter), ['actions' => ArrayParameterType::STRING]));
    }

    /** @return list<array{id: string, name: string}> each event the log names, under the name it last had */
    public function findEvents(AuditFilter $filter): array
    {
        return Type\vec(Type\shape(['id' => Type\string(), 'name' => Type\string()]))->coerce($this->getEntityManager()->getConnection()->fetchAllAssociative(<<<'SQL'
            SELECT DISTINCT ON (event_id) event_id::text AS id, COALESCE(event_name, '') AS name
            FROM   audit_entries
            WHERE  organisation_id = :organisation
              AND  occurred_at >= :since
              AND  event_id IS NOT NULL
              AND  action IN (:actions)
            ORDER  BY event_id, occurred_at DESC
            SQL, $this->menuParameters($filter), ['actions' => ArrayParameterType::STRING]));
    }

    /** @return array{organisation: string, since: string, actions: list<string>} */
    private function menuParameters(AuditFilter $filter): array
    {
        return ['organisation' => $filter->organisationId->toRfc4122(), 'since' => $filter->since->format('Y-m-d H:i:s'), 'actions' => AuditType::actions()];
    }

    private function filtered(AuditFilter $filter): QueryBuilder
    {
        $query = $this->createQueryBuilder('a')
            ->where('a.organisationId = :organisation')
            ->andWhere('a.occurredAt >= :since')
            ->andWhere('a.action IN (:actions)')
            ->setParameter('organisation', $filter->organisationId, 'uuid')
            ->setParameter('since', $filter->since)
            ->setParameter('actions', AuditType::actions($filter->type));

        if (null !== $filter->person) {
            $query->andWhere("a.actorType = 'user' AND a.actorId = :person")->setParameter('person', $filter->person, 'uuid');
        }

        if (null !== $filter->event) {
            $query->andWhere('a.eventId = :event')->setParameter('event', $filter->event, 'uuid');
        }

        if (null !== $filter->from) {
            $query->andWhere('a.occurredAt >= :from')->setParameter('from', $filter->from);
        }

        if (null !== $filter->until) {
            $query->andWhere('a.occurredAt < :until')->setParameter('until', $filter->until);
        }

        return $query;
    }
}
