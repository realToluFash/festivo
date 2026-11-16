<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\MenuDish;
use App\Entity\MenuDishVariant;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<MenuDishVariant> */
final class MenuDishVariantRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MenuDishVariant::class);
    }

    public function loads(): string
    {
        return MenuDishVariant::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?MenuDishVariant
    {
        $found = $this->createQueryBuilder('variant')
            ->join('variant.dish', 'dish')
            ->join('dish.course', 'course')
            ->where('variant.id = :id')
            ->andWhere('course.event = :event')
            ->setParameter('id', $id, 'uuid')
            ->setParameter('event', $eventId, 'uuid')
            ->getQuery()
            ->getOneOrNullResult();

        return Type\nullable(Type\instance_of(MenuDishVariant::class))->coerce($found);
    }

    /** @return list<MenuDishVariant> every variant on the event's menu, each dish's in order */
    public function findOnEvent(Event $event): array
    {
        $found = $this->createQueryBuilder('variant')
            ->join('variant.dish', 'dish')
            ->join('dish.course', 'course')
            ->where('course.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('variant.position', 'ASC')
            ->addOrderBy('variant.id', 'ASC')
            ->getQuery()
            ->getResult();

        return Type\vec(Type\instance_of(MenuDishVariant::class))->coerce($found);
    }

    /** @return list<MenuDishVariant> */
    public function findOnDish(MenuDish $dish): array
    {
        return $this->findBy(['dish' => $dish], ['position' => 'ASC', 'id' => 'ASC']);
    }
}
