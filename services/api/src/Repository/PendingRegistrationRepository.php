<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\PendingRegistration;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<PendingRegistration> */
final class PendingRegistrationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PendingRegistration::class);
    }

    public function findOneByHandleHash(string $handleHash): ?PendingRegistration
    {
        return $this->findOneBy(['handleHash' => $handleHash]);
    }

    /** Whether this address was told it already has an account since `$since`, by any attempt. */
    public function alreadyRegisteredEmailedSince(string $email, DateTimeImmutable $since): bool
    {
        return (int) $this->createQueryBuilder('p')
            ->select('COUNT(p.id)')
            ->where('p.email = :email')
            ->andWhere('p.alreadyRegisteredEmailedAt >= :since')
            ->setParameter('email', $email)
            ->setParameter('since', $since, Types::DATETIME_IMMUTABLE)
            ->getQuery()
            ->getSingleScalarResult() > 0;
    }

    /** @return int how many were deleted */
    public function deleteExpired(DateTimeImmutable $now): int
    {
        return (int) $this->getEntityManager()
            ->createQuery('DELETE FROM ' . PendingRegistration::class . ' p WHERE p.expiresAt <= :now')
            ->setParameter('now', $now, Types::DATETIME_IMMUTABLE)
            ->execute();
    }
}
