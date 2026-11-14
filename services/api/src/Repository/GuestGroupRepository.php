<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\GuestGroup;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<GuestGroup> */
final class GuestGroupRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, GuestGroup::class);
    }

    public function loads(): string
    {
        return GuestGroup::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?GuestGroup
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id]);
    }

    /** @return list<GuestGroup> */
    public function findOnEvent(Event $event): array
    {
        /** @var list<GuestGroup> */
        return $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('g.nameKey', 'ASC')
            ->addOrderBy('g.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function findOneNamed(Event $event, string $nameKey): ?GuestGroup
    {
        return $this->findOneBy(['event' => $event->getId(), 'nameKey' => $nameKey]);
    }

    public function countOnEvent(Event $event): int
    {
        return Type\int()->coerce($this->createQueryBuilder('g')
            ->select('COUNT(g.id)')
            ->where('g.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->getQuery()
            ->getSingleScalarResult());
    }
}
