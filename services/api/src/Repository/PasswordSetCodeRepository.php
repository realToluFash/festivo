<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\PasswordSetCode;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<PasswordSetCode> */
final class PasswordSetCodeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PasswordSetCode::class);
    }

    public function findOneForUser(User $user): ?PasswordSetCode
    {
        return $this->findOneBy(['user' => $user]);
    }
}
