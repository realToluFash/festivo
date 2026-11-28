<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\TwoFactorChallenge;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<TwoFactorChallenge> */
final class TwoFactorChallengeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TwoFactorChallenge::class);
    }

    public function findOneByHash(string $tokenHash): ?TwoFactorChallenge
    {
        return $this->findOneBy(['tokenHash' => $tokenHash]);
    }
}
