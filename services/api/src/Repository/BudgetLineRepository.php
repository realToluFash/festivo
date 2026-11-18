<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\BudgetLine;
use App\Entity\Event;
use App\Enum\CostBasis;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<BudgetLine> */
final class BudgetLineRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, BudgetLine::class);
    }

    public function loads(): string
    {
        return BudgetLine::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?BudgetLine
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id]);
    }

    /** @return list<BudgetLine> in the order they were added */
    public function findOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event], ['id' => 'ASC']);
    }

    public function anyOnEvent(Event $event): bool
    {
        return null !== $this->findOneBy(['event' => $event]);
    }

    public function findStaffLine(Event $event): ?BudgetLine
    {
        return $this->findOneBy(['event' => $event, 'basis' => CostBasis::PerStaffHour]);
    }
}
