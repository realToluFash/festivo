<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Enum\EventStatus;
use App\Enum\EventType;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Str;
use Psl\Vec;
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
     * `$onlyFor` narrows them to the events a Member has a role on (sc-29912).
     *
     * @return list<Event> unfinished soonest first, Finished most recently closed first, then by name
     */
    public function findPageInOrganisation(Organisation $organisation, bool $finished, DateTimeImmutable $now, int $page, int $perPage, ?Membership $onlyFor = null, EventSearch $search = new EventSearch()): array
    {
        /** @var list<Event> */
        return $this->searched($this->phaseIn($organisation, $finished, $now, $onlyFor), $search)
            ->orderBy($finished ? 'e.closesAt' : 'e.startsAtUtc', $finished ? 'DESC' : 'ASC')
            ->addOrderBy('e.name', 'ASC')
            ->addOrderBy('e.id', 'ASC')
            ->setFirstResult(($page - 1) * $perPage)
            ->setMaxResults($perPage)
            ->getQuery()
            ->getResult();
    }

    public function countPhaseInOrganisation(Organisation $organisation, bool $finished, DateTimeImmutable $now, ?Membership $onlyFor = null, EventSearch $search = new EventSearch()): int
    {
        return (int) $this->searched($this->phaseIn($organisation, $finished, $now, $onlyFor), $search)
            ->select('COUNT(e.id)')
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * The names on the hosts' lines of the events `$onlyFor` sees, each once whatever its case (sc-30302).
     *
     * @return list<string> alphabetical
     */
    public function findHostNamesInOrganisation(Organisation $organisation, ?Membership $onlyFor = null): array
    {
        /** @var list<array{hosts: list<string>}> $rows */
        $rows = $this->onlyFor($this->createQueryBuilder('e'), $onlyFor)
            ->select('e.hosts')
            ->andWhere('e.organisation = :organisation')
            ->setParameter('organisation', $organisation)
            ->orderBy('e.startsAtUtc', 'ASC')
            ->addOrderBy('e.id', 'ASC')
            ->getQuery()
            ->getArrayResult();
        $names = [];

        foreach ($rows as $row) {
            foreach ($row['hosts'] as $name) {
                $names[Str\lowercase($name)] ??= $name;
            }
        }

        return Vec\sort(Vec\values($names), static fn (string $a, string $b): int => Str\Byte\compare_ci($a, $b));
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

    private function phaseIn(Organisation $organisation, bool $finished, DateTimeImmutable $now, ?Membership $onlyFor): QueryBuilder
    {
        $over = 'e.status = :ended OR (e.status IN (:active) AND e.closesAt <= :now)';

        return $this->onlyFor($this->createQueryBuilder('e'), $onlyFor)
            ->andWhere('e.organisation = :organisation')
            ->andWhere($finished ? $over : 'NOT (' . $over . ')')
            ->setParameter('organisation', $organisation)
            ->setParameter('ended', EventStatus::Ended->value)
            ->setParameter('active', [EventStatus::Live->value, EventStatus::Paused->value])
            ->setParameter('now', $now->setTimezone(new DateTimeZone('UTC')), 'datetime_immutable');
    }

    /**
     * Every event of the organisation, and those deleted after $deletedAfter, which a subscribed calendar is told are cancelled (sc-3626).
     *
     * @return list<Event> soonest first
     */
    public function findForCalendarFeed(Organisation $organisation, DateTimeImmutable $deletedAfter, ?Membership $onlyFor = null): array
    {
        $filters = $this->getEntityManager()->getFilters();
        $filtered = $filters->isEnabled('soft_delete');

        if ($filtered) {
            $filters->disable('soft_delete');
        }

        try {
            /** @var list<Event> */
            return $this->onlyFor($this->createQueryBuilder('e'), $onlyFor)
                ->andWhere('e.organisation = :organisation')
                ->andWhere('e.deletedAt IS NULL OR e.deletedAt > :since')
                ->setParameter('organisation', $organisation)
                ->setParameter('since', $deletedAfter->setTimezone(new DateTimeZone('UTC')), 'datetime_immutable')
                ->orderBy('e.startsAtUtc', 'ASC')
                ->addOrderBy('e.id', 'ASC')
                ->getQuery()
                ->getResult();
        } finally {
            if ($filtered) {
                $filters->enable('soft_delete');
            }
        }
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

    private function searched(QueryBuilder $query, EventSearch $search): QueryBuilder
    {
        if (null !== $search->term) {
            $query
                ->andWhere('FOLDED(e.name) LIKE FOLDED(:term) OR FOLDED(e.venueName) LIKE FOLDED(:term)')
                ->setParameter('term', '%' . \addcslashes($search->term, '\\%_') . '%');
        }

        if ([] !== $search->types) {
            $query
                ->andWhere('e.type IN (:types)')
                ->setParameter('types', Vec\map($search->types, static fn (EventType $type): string => $type->value));
        }

        if (null !== $search->from) {
            $query
                ->andWhere('e.endsAt > :from')
                ->setParameter('from', $search->from, 'datetime_immutable');
        }

        if (null !== $search->to) {
            $query
                ->andWhere('e.startsAt < :dayAfterTo')
                ->setParameter('dayAfterTo', $search->to->modify('+1 day'), 'datetime_immutable');
        }

        if ([] !== $search->hosts) {
            $query->andWhere($query->expr()->orX(...Vec\map_with_key(
                $search->hosts,
                static fn (int $index, string $host): string => 'HOLDS_NAME(e.hosts, :host' . $index . ') = true',
            )));

            foreach ($search->hosts as $index => $host) {
                $query->setParameter('host' . $index, $host);
            }
        }

        return $query;
    }

    private function onlyFor(QueryBuilder $query, ?Membership $member): QueryBuilder
    {
        if (null === $member) {
            return $query;
        }

        return $query
            ->andWhere('EXISTS (SELECT 1 FROM ' . EventPerson::class . ' p WHERE p.event = e AND p.membership = :member)')
            ->setParameter('member', $member);
    }
}
