<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\PasskeyChallenge;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<PasskeyChallenge> */
final class PasskeyChallengeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PasskeyChallenge::class);
    }

    public function findOneByHash(string $challengeHash): ?PasskeyChallenge
    {
        return $this->findOneBy(['challengeHash' => $challengeHash]);
    }
}
