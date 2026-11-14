<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\SeatingPlan;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<SeatingPlan> */
final class SeatingPlanRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SeatingPlan::class);
    }

    public function findOneForEvent(Event $event): ?SeatingPlan
    {
        return $this->findOneBy(['event' => $event]);
    }
}
