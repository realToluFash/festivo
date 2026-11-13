<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\Organisation;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<Guest> */
final class GuestRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Guest::class);
    }

    /** @return list<Guest> hosts and companions alike, each companion in its place */
    public function findOnList(Event $event): array
    {
        /** @var list<Guest> */
        return $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('g.position', 'ASC')
            ->addOrderBy('g.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** Guests and companions together: the Guests header's N. */
    public function countPeople(Event $event): int
    {
        return Type\int()->coerce($this->createQueryBuilder('g')
            ->select('COUNT(g.id)')
            ->where('g.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->getQuery()
            ->getSingleScalarResult());
    }

    /** Guests and companions on every event the organisation still has. */
    public function countInOrganisation(Organisation $organisation): int
    {
        return Type\int()->coerce($this->createQueryBuilder('g')
            ->select('COUNT(g.id)')
            ->innerJoin('g.event', 'e')
            ->where('e.organisation = :organisation')
            ->setParameter('organisation', $organisation->getId(), 'uuid')
            ->getQuery()
            ->getSingleScalarResult());
    }

    public function findOneNamed(Event $event, string $nameKey, ?Guest $other = null): ?Guest
    {
        $query = $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->andWhere('g.nameKey = :key')
            ->setParameter('event', $event->getId(), 'uuid')
            ->setParameter('key', $nameKey)
            ->setMaxResults(1);

        if (null !== $other) {
            $query->andWhere('g.id <> :other')->setParameter('other', $other->getId(), 'uuid');
        }

        /** @var ?Guest */
        return $query->getQuery()->getOneOrNullResult();
    }

    /** A guest on the list, not a companion, and only on this event: anything else is not found. */
    public function findHostOn(Event $event, string $id): ?Guest
    {
        if (!Uuid::isValid($id)) {
            return null;
        }

        /** @var ?Guest */
        return $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->andWhere('g.host IS NULL')
            ->andWhere('g.id = :id')
            ->setParameter('event', $event->getId(), 'uuid')
            ->setParameter('id', Uuid::fromString($id), 'uuid')
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** @return list<Guest> in their places under the host */
    public function findCompanionsOf(Guest $host): array
    {
        /** @var list<Guest> */
        return $this->createQueryBuilder('g')
            ->where('g.host = :host')
            ->setParameter('host', $host->getId(), 'uuid')
            ->orderBy('g.position', 'ASC')
            ->addOrderBy('g.id', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
