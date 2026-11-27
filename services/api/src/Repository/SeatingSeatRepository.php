<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\SeatingPlan;
use App\Entity\SeatingSeat;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<SeatingSeat> */
final class SeatingSeatRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SeatingSeat::class);
    }

    public function loads(): string
    {
        return SeatingSeat::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?SeatingSeat
    {
        /** @var ?SeatingSeat */
        return $this->createQueryBuilder('s')
            ->innerJoin('s.plan', 'p')
            ->where('s.id = :id')
            ->andWhere('p.event = :event')
            ->setParameter('id', $id, 'uuid')
            ->setParameter('event', $eventId, 'uuid')
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** @return list<SeatingSeat> in the order they were added */
    public function findInPlan(SeatingPlan $plan): array
    {
        return $this->findBy(['plan' => $plan], ['id' => 'ASC']);
    }
}
