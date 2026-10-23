<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\TwoFactorFactor;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<TwoFactorFactor> */
final class TwoFactorFactorRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TwoFactorFactor::class);
    }

    public function findOneFor(User $user): ?TwoFactorFactor
    {
        return $this->findOneBy(['user' => $user]);
    }

    public function findActiveFor(User $user): ?TwoFactorFactor
    {
        $factor = $this->findOneFor($user);

        return null !== $factor && $factor->isActive() ? $factor : null;
    }
}
