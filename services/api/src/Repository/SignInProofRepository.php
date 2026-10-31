<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\SignInProof;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<SignInProof> */
final class SignInProofRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SignInProof::class);
    }

    public function findOneByHash(string $tokenHash): ?SignInProof
    {
        return $this->findOneBy(['tokenHash' => $tokenHash]);
    }
}
