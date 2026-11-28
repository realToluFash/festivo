<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\SeatingPlan;
use App\Entity\SeatingTable;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<SeatingTable> */
final class SeatingTableRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SeatingTable::class);
    }

    public function loads(): string
    {
        return SeatingTable::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?SeatingTable
    {
        /** @var ?SeatingTable */
        return $this->createQueryBuilder('t')
            ->innerJoin('t.plan', 'p')
            ->where('t.id = :id')
            ->andWhere('p.event = :event')
            ->setParameter('id', $id, 'uuid')
            ->setParameter('event', $eventId, 'uuid')
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** @return list<SeatingTable> in the order they were added */
    public function findInPlan(SeatingPlan $plan): array
    {
        return $this->findBy(['plan' => $plan], ['id' => 'ASC']);
    }
}
