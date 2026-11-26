<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\ServiceTap;
use App\Entity\User;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<ServiceTap> */
final class ServiceTapRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ServiceTap::class);
    }

    public function findKept(User $by, string $key, DateTimeImmutable $since): ?ServiceTap
    {
        $tap = $this->findOneBy(['by' => $by, 'idempotencyKey' => $key]);

        return null !== $tap && $tap->getMadeAt() >= $since ? $tap : null;
    }

    public function forget(User $by, DateTimeImmutable $before): void
    {
        $this->getEntityManager()->createQueryBuilder()
            ->delete(ServiceTap::class, 'tap')
            ->where('tap.by = :by')
            ->andWhere('tap.madeAt < :before')
            ->setParameter('by', $by)
            ->setParameter('before', $before)
            ->getQuery()
            ->execute();
    }
}
