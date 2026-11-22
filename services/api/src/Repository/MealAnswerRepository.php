<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\MenuDish;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;

/** @extends ServiceEntityRepository<MealAnswer> */
final class MealAnswerRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MealAnswer::class);
    }

    /**
     * @param list<Guest> $people
     *
     * @return list<MealAnswer>
     */
    public function findFor(array $people): array
    {
        if ([] === $people) {
            return [];
        }

        $found = $this->createQueryBuilder('answer')
            ->where('answer.person IN (:people)')
            ->setParameter('people', $people)
            ->getQuery()
            ->getResult();

        return Type\vec(Type\instance_of(MealAnswer::class))->coerce($found);
    }

    /** @return list<MealAnswer> every answer naming the dish, whatever its kind */
    public function findNaming(MenuDish $dish): array
    {
        return $this->findBy(['dish' => $dish]);
    }

    /** @return list<MealAnswer> */
    public function findOnEvent(Event $event): array
    {
        $found = $this->createQueryBuilder('answer')
            ->join('answer.course', 'course')
            ->where('course.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->getQuery()
            ->getResult();

        return Type\vec(Type\instance_of(MealAnswer::class))->coerce($found);
    }
}
