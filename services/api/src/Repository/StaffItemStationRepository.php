<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\StaffItemStation;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<StaffItemStation> */
final class StaffItemStationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, StaffItemStation::class);
    }

    /** @return list<StaffItemStation> */
    public function findOnEvent(Event $event): array
    {
        /** @var list<StaffItemStation> */
        return $this->createQueryBuilder('i')
            ->innerJoin('i.station', 's')
            ->where('s.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->getQuery()
            ->getResult();
    }

    public function findOneOfItem(MenuCourse $course, string $itemKey): ?StaffItemStation
    {
        return $this->findOneBy(['course' => $course, 'itemKey' => $itemKey]);
    }
}
