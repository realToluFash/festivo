<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<MenuCourse> */
final class MenuCourseRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MenuCourse::class);
    }

    public function loads(): string
    {
        return MenuCourse::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?MenuCourse
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id]);
    }

    /** @return list<MenuCourse> in the menu's order */
    public function findOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event], ['position' => 'ASC', 'id' => 'ASC']);
    }
}
