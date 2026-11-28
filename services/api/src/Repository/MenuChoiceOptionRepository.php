<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuDishChoice;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;

/** @extends ServiceEntityRepository<MenuChoiceOption> */
final class MenuChoiceOptionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MenuChoiceOption::class);
    }

    /** @return list<MenuChoiceOption> every option on the event's menu, each choice's in order */
    public function findOnEvent(Event $event): array
    {
        $found = $this->createQueryBuilder('option')
            ->join('option.choice', 'choice')
            ->join('choice.dish', 'dish')
            ->join('dish.course', 'course')
            ->where('course.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('option.position', 'ASC')
            ->addOrderBy('option.id', 'ASC')
            ->getQuery()
            ->getResult();

        return Type\vec(Type\instance_of(MenuChoiceOption::class))->coerce($found);
    }

    /** @return list<MenuChoiceOption> */
    public function findOnChoice(MenuDishChoice $choice): array
    {
        return $this->findBy(['choice' => $choice], ['position' => 'ASC', 'id' => 'ASC']);
    }
}
