<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<EventPerson> */
final class EventPersonRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, EventPerson::class);
    }

    public function loads(): string
    {
        return EventPerson::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?EventPerson
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id]);
    }

    public function findOneOn(Uuid $eventId, Membership $membership): ?EventPerson
    {
        return $this->findOneBy(['event' => $eventId, 'membership' => $membership]);
    }

    /** @return list<EventPerson> */
    public function findOnEvent(Uuid $eventId): array
    {
        /** @var list<EventPerson> */
        return $this->createQueryBuilder('p')
            ->select('p', 'm', 'u')
            ->innerJoin('p.membership', 'm')
            ->innerJoin('m.user', 'u')
            ->where('p.event = :event')
            ->setParameter('event', $eventId, 'uuid')
            ->orderBy('u.name', 'ASC')
            ->addOrderBy('p.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** @return list<EventPerson> */
    public function findFor(Membership $membership): array
    {
        return $this->findBy(['membership' => $membership]);
    }

    public function deleteFor(Membership $membership): void
    {
        $this->createQueryBuilder('p')
            ->delete()
            ->where('p.membership = :membership')
            ->setParameter('membership', $membership)
            ->getQuery()
            ->execute();
    }
}
