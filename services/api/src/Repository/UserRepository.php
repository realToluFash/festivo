<?php

declare(strict_types=1);

namespace App\Repository;

use App\Domain\User\EmailAddressNormaliser;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<User> */
final class UserRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, User::class);
    }

    /**
     * By the primary address only, because that is the one the account is
     * identified by. An alternative address is a way to reach somebody, not a
     * second way to be them — so it must not sign anybody in.
     *
     * Use EmailAddressRepository::findOneByAddress() to ask whether an address
     * is claimed at all. That question spans every address and this one does
     * not, and collapsing the two would make an alternative address a set of
     * credentials.
     */
    public function findOneByPrimaryEmailAddress(string $address): ?User
    {
        return $this->createQueryBuilder('u')
            ->join('u.emailAddresses', 'e')
            ->andWhere('e.address = :address')
            ->andWhere('e.isPrimary = true')
            ->setParameter('address', EmailAddressNormaliser::normalise($address))
            ->getQuery()
            ->getOneOrNullResult();
    }
}
