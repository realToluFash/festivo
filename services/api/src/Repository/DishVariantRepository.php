<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Dish;
use App\Entity\DishVariant;
use App\Entity\Organisation;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<DishVariant> */
final class DishVariantRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DishVariant::class);
    }

    public function findOneOnDish(Dish $dish, Uuid $id): ?DishVariant
    {
        return $this->findOneBy(['dish' => $dish, 'id' => $id]);
    }

    /** @return list<DishVariant> */
    public function findOnDish(Dish $dish): array
    {
        return $this->findBy(['dish' => $dish], ['position' => 'ASC', 'id' => 'ASC']);
    }

    /** @return list<DishVariant> every variant in the organisation's library, each dish's in order */
    public function findInOrganisation(Organisation $organisation): array
    {
        $found = $this->createQueryBuilder('variant')
            ->join('variant.dish', 'dish')
            ->where('dish.organisation = :organisation')
            ->setParameter('organisation', $organisation->getId(), 'uuid')
            ->orderBy('variant.position', 'ASC')
            ->addOrderBy('variant.id', 'ASC')
            ->getQuery()
            ->getResult();

        return Type\vec(Type\instance_of(DishVariant::class))->coerce($found);
    }
}
