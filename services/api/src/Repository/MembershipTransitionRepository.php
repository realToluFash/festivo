<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\MembershipTransition;
use App\Entity\Organisation;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<MembershipTransition> */
final class MembershipTransitionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MembershipTransition::class);
    }

    /** @return list<MembershipTransition> every member's history in one read, oldest first */
    public function findInOrganisation(Organisation $organisation): array
    {
        return $this->createQueryBuilder('t')
            ->join('t.membership', 'm')
            ->andWhere('m.organisation = :organisation')
            ->setParameter('organisation', $organisation)
            ->orderBy('t.occurredAt', 'ASC')
            ->addOrderBy('t.id', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
