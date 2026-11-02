<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\RecoveryCode;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<RecoveryCode> */
final class RecoveryCodeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RecoveryCode::class);
    }

    /** @return list<RecoveryCode> */
    public function findAllFor(User $user): array
    {
        return $this->findBy(['user' => $user]);
    }

    public function countUnusedFor(User $user): int
    {
        return $this->count(['user' => $user, 'usedAt' => null]);
    }

    /** New codes replace every old one, used or not, so an old printout is worth nothing. */
    public function deleteAllFor(User $user): void
    {
        $this->getEntityManager()
            ->createQuery('DELETE FROM ' . RecoveryCode::class . ' c WHERE c.user = :user')
            ->setParameter('user', $user)
            ->execute();
    }
}
