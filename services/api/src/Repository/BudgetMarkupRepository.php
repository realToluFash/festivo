<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\BudgetMarkup;
use App\Entity\Event;
use App\Enum\CostCategory;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<BudgetMarkup> */
final class BudgetMarkupRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, BudgetMarkup::class);
    }

    /** @return list<BudgetMarkup> */
    public function findOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event], ['id' => 'ASC']);
    }

    /** The event's own with no category. */
    public function findFor(Event $event, ?CostCategory $category): ?BudgetMarkup
    {
        return $this->findOneBy(['event' => $event, 'category' => $category]);
    }
}
