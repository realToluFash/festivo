<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\ProviderIdentity;
use App\Enum\IdentityProvider;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<ProviderIdentity> */
final class ProviderIdentityRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ProviderIdentity::class);
    }

    public function findOneBySubject(IdentityProvider $provider, string $subject): ?ProviderIdentity
    {
        return $this->findOneBy(['provider' => $provider, 'subject' => $subject]);
    }
}
