<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\Organisation;
use App\Enum\EventStatus;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<Event> */
final class EventRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Event::class);
    }

    /**
     * Finished is Ended, or Live or Paused past its close: EventPhase's rule, as the clients group by it (sc-3594).
     *
     * @return list<Event> unfinished soonest first, Finished most recently closed first, then by name
     */
    public function findPageInOrganisation(Organisation $organisation, bool $finished, DateTimeImmutable $now, int $page, int $perPage): array
    {
        /** @var list<Event> */
        return $this->phaseIn($organisation, $finished, $now)
            ->orderBy($finished ? 'e.closesAt' : 'e.startsAtUtc', $finished ? 'DESC' : 'ASC')
            ->addOrderBy('e.name', 'ASC')
            ->addOrderBy('e.id', 'ASC')
            ->setFirstResult(($page - 1) * $perPage)
            ->setMaxResults($perPage)
            ->getQuery()
            ->getResult();
    }

    public function countPhaseInOrganisation(Organisation $organisation, bool $finished, DateTimeImmutable $now): int
    {
        return (int) $this->phaseIn($organisation, $finished, $now)
            ->select('COUNT(e.id)')
            ->getQuery()
            ->getSingleScalarResult();
    }

    public function countInOrganisation(Organisation $organisation): int
    {
        return $this->count(['organisation' => $organisation]);
    }

    /** Live or Paused and not yet Finished: what the plan's active-events limit counts (sc-3586, "Decided, 21 Oct"). */
    public function countActiveIn(Organisation $organisation, DateTimeImmutable $now): int
    {
        return (int) $this->createQueryBuilder('e')
            ->select('COUNT(e.id)')
            ->andWhere('e.organisation = :organisation')
            ->andWhere('e.status IN (:active)')
            ->andWhere('e.closesAt > :now')
            ->setParameter('organisation', $organisation)
            ->setParameter('active', [EventStatus::Live->value, EventStatus::Paused->value])
            ->setParameter('now', $now->setTimezone(new DateTimeZone('UTC')), 'datetime_immutable')
            ->getQuery()
            ->getSingleScalarResult();
    }

    private function phaseIn(Organisation $organisation, bool $finished, DateTimeImmutable $now): QueryBuilder
    {
        $over = 'e.status = :ended OR (e.status IN (:active) AND e.closesAt <= :now)';

        return $this->createQueryBuilder('e')
            ->andWhere('e.organisation = :organisation')
            ->andWhere($finished ? $over : 'NOT (' . $over . ')')
            ->setParameter('organisation', $organisation)
            ->setParameter('ended', EventStatus::Ended->value)
            ->setParameter('active', [EventStatus::Live->value, EventStatus::Paused->value])
            ->setParameter('now', $now->setTimezone(new DateTimeZone('UTC')), 'datetime_immutable');
    }

    public function findOrganisationIdOf(Uuid $eventId): ?Uuid
    {
        $id = $this->createQueryBuilder('e')
            ->select('IDENTITY(e.organisation)')
            ->andWhere('e.id = :id')
            ->setParameter('id', $eventId, 'uuid')
            ->getQuery()
            ->getOneOrNullResult();

        return \is_array($id) && \is_string($id[1] ?? null) ? Uuid::fromString($id[1]) : null;
    }
}
