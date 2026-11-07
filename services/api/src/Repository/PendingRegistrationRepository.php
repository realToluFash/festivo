<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\PendingRegistration;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Query;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

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

    /** Read afresh under a row lock: null once another request has used it up. */
    public function findForUpdate(Uuid $id): ?PendingRegistration
    {
        return $this->createQueryBuilder('p')
            ->where('p.id = :id')
            ->setParameter('id', $id, 'uuid')
            ->getQuery()
            ->setLockMode(LockMode::PESSIMISTIC_WRITE)
            ->setHint(Query::HINT_REFRESH, true)
            ->getOneOrNullResult();
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
