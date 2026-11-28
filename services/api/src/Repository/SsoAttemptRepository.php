<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\SsoAttempt;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<SsoAttempt> */
final class SsoAttemptRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SsoAttempt::class);
    }

    /** True for one caller only, however many answers arrive at once. */
    public function claim(SsoAttempt $attempt): bool
    {
        return 1 === $this->getEntityManager()->getConnection()->executeStatement(
            'DELETE FROM organisation_sso_attempts WHERE id = :id',
            ['id' => $attempt->getId()->toRfc4122()],
        );
    }
}
