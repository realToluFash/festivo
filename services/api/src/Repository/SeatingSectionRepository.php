<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\SeatingPlan;
use App\Entity\SeatingSection;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<SeatingSection> */
final class SeatingSectionRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SeatingSection::class);
    }

    public function loads(): string
    {
        return SeatingSection::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?SeatingSection
    {
        /** @var ?SeatingSection */
        return $this->createQueryBuilder('s')
            ->innerJoin('s.plan', 'p')
            ->where('s.id = :id')
            ->andWhere('p.event = :event')
            ->setParameter('id', $id, 'uuid')
            ->setParameter('event', $eventId, 'uuid')
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** @return list<SeatingSection> in the order they were added */
    public function findInPlan(SeatingPlan $plan): array
    {
        return $this->findBy(['plan' => $plan], ['id' => 'ASC']);
    }
}
