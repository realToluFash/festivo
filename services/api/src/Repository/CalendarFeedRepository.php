<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\CalendarFeed;
use App\Entity\Organisation;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<CalendarFeed> */
final class CalendarFeedRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CalendarFeed::class);
    }

    public function findOneFor(User $user, Organisation $organisation): ?CalendarFeed
    {
        return $this->findOneBy(['user' => $user, 'organisation' => $organisation]);
    }

    /** Joined to its account, so a deleted account's link finds nothing. */
    public function findOneByTokenHash(string $tokenHash): ?CalendarFeed
    {
        $feed = $this->createQueryBuilder('f')
            ->addSelect('u', 'o')
            ->innerJoin('f.user', 'u')
            ->innerJoin('f.organisation', 'o')
            ->andWhere('f.tokenHash = :hash')
            ->setParameter('hash', $tokenHash)
            ->getQuery()
            ->getOneOrNullResult();

        return $feed instanceof CalendarFeed ? $feed : null;
    }
}
