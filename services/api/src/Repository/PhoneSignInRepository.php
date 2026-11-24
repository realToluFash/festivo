<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\PhoneSignIn;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<PhoneSignIn> */
final class PhoneSignInRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PhoneSignIn::class);
    }

    public function findOneByHandleHash(string $handleHash): ?PhoneSignIn
    {
        return $this->findOneBy(['handleHash' => $handleHash]);
    }
}
