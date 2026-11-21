<?php

declare(strict_types=1);

namespace App\Repository;

use App\Domain\User\EmailAddressNormaliser;
use App\Entity\EmailAddress;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<EmailAddress> */
final class EmailAddressRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, EmailAddress::class);
    }

    public function findOneByAddress(string $address): ?EmailAddress
    {
        return $this->findOneBy(['address' => EmailAddressNormaliser::normalise($address)]);
    }

    /** @return list<EmailAddress> a hostname has no LIKE wildcard in it; each account's verified main address at the domain, the accounts with them */
    public function findVerifiedPrimariesAt(string $domain): array
    {
        /** @var list<EmailAddress> */
        return $this->createQueryBuilder('e')
            ->select('e', 'u')
            ->innerJoin('e.user', 'u')
            ->where('e.isPrimary = true')
            ->andWhere('e.verifiedAt IS NOT NULL')
            ->andWhere('e.address LIKE :atDomain')
            ->setParameter('atDomain', '%@' . $domain)
            ->orderBy('e.id', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
