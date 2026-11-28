<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\ScheduleItem;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<ScheduleItem> */
final class ScheduleItemRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ScheduleItem::class);
    }

    public function loads(): string
    {
        return ScheduleItem::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?ScheduleItem
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id]);
    }

    /** @return list<ScheduleItem> by wall-clock start, then in the order they were added */
    public function findOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event], ['startsAt' => 'ASC', 'id' => 'ASC']);
    }

    public function findOneByCourse(MenuCourse $course): ?ScheduleItem
    {
        return $this->findOneBy(['course' => $course]);
    }

    public function countOnEvent(Event $event): int
    {
        return $this->count(['event' => $event]);
    }
}
