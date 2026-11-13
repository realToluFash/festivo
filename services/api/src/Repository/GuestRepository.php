<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\Organisation;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<Guest> */
final class GuestRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Guest::class);
    }

    public function loads(): string
    {
        return Guest::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?Guest
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id]);
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

    public function countCompanions(Guest $host): int
    {
        return Type\int()->coerce($this->createQueryBuilder('g')
            ->select('COUNT(g.id)')
            ->where('g.host = :host')
            ->setParameter('host', $host->getId(), 'uuid')
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

    public function findOneNamed(Event $event, string $nameKey): ?Guest
    {
        /** @var ?Guest */
        return $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->andWhere('g.nameKey = :key')
            ->setParameter('event', $event->getId(), 'uuid')
            ->setParameter('key', $nameKey)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** Only through an event that is not deleted, so a deleted event's links answer as unknown ones and a restore brings them back (sc-1526). */
    public function findOneByLink(#[SensitiveParameter] string $token): ?Guest
    {
        /** @var ?Guest */
        return $this->createQueryBuilder('g')
            ->innerJoin('g.event', 'e')
            ->where('g.linkToken = :token')
            ->andWhere('g.host IS NULL')
            ->andWhere('e.deletedAt IS NULL')
            ->setParameter('token', $token)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** The guests whose link someone said reached the wrong person, for the hosts' notice (sc-1526). @return list<Guest> */
    public function findFlagged(Event $event): array
    {
        /** @var list<Guest> */
        return $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->andWhere('g.linkFlagged = true')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('g.position', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
