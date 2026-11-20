<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Dish;
use App\Entity\Organisation;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<Dish> */
final class DishRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Dish::class);
    }

    public function findOneInOrganisation(Organisation $organisation, Uuid $id): ?Dish
    {
        return $this->findOneBy(['organisation' => $organisation, 'id' => $id]);
    }

    /** @return list<Dish> archived ones included, in the order they were added */
    public function findInOrganisation(Organisation $organisation): array
    {
        return $this->findBy(['organisation' => $organisation], ['id' => 'ASC']);
    }
}
