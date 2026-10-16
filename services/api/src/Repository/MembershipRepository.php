<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Membership;
use App\Entity\User;
use App\Enum\MembershipStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<Membership> */
final class MembershipRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Membership::class);
    }

    public function findActive(User $user, Uuid $organisationId): ?Membership
    {
        return $this->findOneBy([
            'user' => $user,
            'organisation' => $organisationId,
            'status' => MembershipStatus::Active,
        ]);
    }

    /** @return list<Membership> oldest first, so the organisation somebody founded leads */
    public function findActiveFor(User $user): array
    {
        return $this->findBy(['user' => $user, 'status' => MembershipStatus::Active], ['createdAt' => 'ASC', 'id' => 'ASC']);
    }
}
