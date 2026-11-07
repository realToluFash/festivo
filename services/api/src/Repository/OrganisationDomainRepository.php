<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<OrganisationDomain> */
final class OrganisationDomainRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, OrganisationDomain::class);
    }

    /** @return list<OrganisationDomain> in the order they were added */
    public function findForOrganisation(Organisation $organisation): array
    {
        return $this->findBy(['organisation' => $organisation], ['createdAt' => 'ASC', 'id' => 'ASC']);
    }

    public function findOneInOrganisation(Organisation $organisation, string $domain): ?OrganisationDomain
    {
        return $this->findOneBy(['organisation' => $organisation, 'domain' => $domain]);
    }

    /** @return list<OrganisationDomain> every organisation's listing of it, oldest first; the join leaves deleted organisations out */
    public function findListings(string $domain): array
    {
        /** @var list<OrganisationDomain> */
        return $this->createQueryBuilder('d')
            ->select('d', 'o')
            ->innerJoin('d.organisation', 'o')
            ->where('d.domain = :domain')
            ->setParameter('domain', $domain)
            ->orderBy('d.createdAt', 'ASC')
            ->addOrderBy('d.id', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
