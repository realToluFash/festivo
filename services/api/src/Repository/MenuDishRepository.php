<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<MenuDish> */
final class MenuDishRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MenuDish::class);
    }

    public function loads(): string
    {
        return MenuDish::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?MenuDish
    {
        $found = $this->createQueryBuilder('dish')
            ->join('dish.course', 'course')
            ->where('dish.id = :id')
            ->andWhere('course.event = :event')
            ->setParameter('id', $id, 'uuid')
            ->setParameter('event', $eventId, 'uuid')
            ->getQuery()
            ->getOneOrNullResult();

        return Type\nullable(Type\instance_of(MenuDish::class))->coerce($found);
    }

    /** @return list<MenuDish> every dish on the event's menu, course by course, each course's in the order they were added */
    public function findOnEvent(Event $event): array
    {
        $found = $this->createQueryBuilder('dish')
            ->join('dish.course', 'course')
            ->where('course.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('dish.position', 'ASC')
            ->addOrderBy('dish.id', 'ASC')
            ->getQuery()
            ->getResult();

        return Type\vec(Type\instance_of(MenuDish::class))->coerce($found);
    }

    /** @return list<MenuDish> */
    public function findOnCourse(MenuCourse $course): array
    {
        return $this->findBy(['course' => $course], ['position' => 'ASC', 'id' => 'ASC']);
    }
}
