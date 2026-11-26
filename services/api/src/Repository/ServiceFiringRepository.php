<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\ServiceFiring;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<ServiceFiring> */
final class ServiceFiringRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ServiceFiring::class);
    }

    /** @return list<ServiceFiring> */
    public function findOfCourse(MenuCourse $course): array
    {
        return $this->findBy(['course' => $course]);
    }

    /** @return list<ServiceFiring> */
    public function findAtTable(Event $event, string $tableKey): array
    {
        return $this->findBy(['event' => $event, 'tableKey' => $tableKey]);
    }

    public function findOneAt(MenuCourse $course, string $tableKey): ?ServiceFiring
    {
        return $this->findOneBy(['course' => $course, 'tableKey' => $tableKey]);
    }
}
