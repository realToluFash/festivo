<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\AppleAppAttempt;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<AppleAppAttempt> */
final class AppleAppAttemptRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AppleAppAttempt::class);
    }

    public function findOneByStateHash(string $stateHash): ?AppleAppAttempt
    {
        return $this->findOneBy(['stateHash' => $stateHash]);
    }

    public function findOneByHandleHash(string $handleHash): ?AppleAppAttempt
    {
        return $this->findOneBy(['handleHash' => $handleHash]);
    }
}
