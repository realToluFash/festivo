<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<MenuDishChoice> */
final class MenuDishChoiceRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MenuDishChoice::class);
    }

    public function loads(): string
    {
        return MenuDishChoice::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?MenuDishChoice
    {
        $found = $this->createQueryBuilder('choice')
            ->join('choice.dish', 'dish')
            ->join('dish.course', 'course')
            ->where('choice.id = :id')
            ->andWhere('course.event = :event')
            ->setParameter('id', $id, 'uuid')
            ->setParameter('event', $eventId, 'uuid')
            ->getQuery()
            ->getOneOrNullResult();

        return Type\nullable(Type\instance_of(MenuDishChoice::class))->coerce($found);
    }

    /** @return list<MenuDishChoice> every choice on the event's menu, each dish's in order */
    public function findOnEvent(Event $event): array
    {
        $found = $this->createQueryBuilder('choice')
            ->join('choice.dish', 'dish')
            ->join('dish.course', 'course')
            ->where('course.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('choice.position', 'ASC')
            ->addOrderBy('choice.id', 'ASC')
            ->getQuery()
            ->getResult();

        return Type\vec(Type\instance_of(MenuDishChoice::class))->coerce($found);
    }

    /** @return list<MenuDishChoice> */
    public function findOnDish(MenuDish $dish): array
    {
        return $this->findBy(['dish' => $dish], ['position' => 'ASC', 'id' => 'ASC']);
    }
}
