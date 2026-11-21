<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\SeatingPlan;
use App\Entity\TableSharing;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<TableSharing> */
final class TableSharingRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TableSharing::class);
    }

    public function findOneForPlan(SeatingPlan $plan): ?TableSharing
    {
        return $this->findOneBy(['plan' => $plan]);
    }

    public function findOneForEvent(Event $event): ?TableSharing
    {
        return $this->createQueryBuilder('sharing')
            ->innerJoin('sharing.plan', 'plan')
            ->andWhere('plan.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->getQuery()
            ->getOneOrNullResult();
    }
}
