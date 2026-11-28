<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\KitchenFinalNumbers;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<KitchenFinalNumbers> */
final class KitchenFinalNumbersRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, KitchenFinalNumbers::class);
    }

    public function findOneForEvent(Event $event): ?KitchenFinalNumbers
    {
        return $this->findOneBy(['event' => $event]);
    }
}
