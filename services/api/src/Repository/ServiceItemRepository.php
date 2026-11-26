<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\MenuCourse;
use App\Entity\ServiceItem;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<ServiceItem> */
final class ServiceItemRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ServiceItem::class);
    }

    /** @return list<ServiceItem> */
    public function findOfCourse(MenuCourse $course): array
    {
        return $this->findBy(['course' => $course]);
    }

    public function findOneOf(MenuCourse $course, string $itemKey): ?ServiceItem
    {
        return $this->findOneBy(['course' => $course, 'itemKey' => $itemKey]);
    }
}
