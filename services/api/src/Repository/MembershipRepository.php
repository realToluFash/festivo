<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\ProviderIdentity;
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

    public function findActiveByUserId(Uuid $userId, Uuid $organisationId): ?Membership
    {
        return $this->findOneBy(['user' => $userId, 'organisation' => $organisationId, 'status' => MembershipStatus::Active]);
    }

    /** @return list<Membership> oldest first, so the organisation somebody founded leads */
    public function findActiveFor(User $user): array
    {
        return $this->findBy(['user' => $user, 'status' => MembershipStatus::Active], ['createdAt' => 'ASC', 'id' => 'ASC']);
    }

    /** @return list<Membership> */
    public function findActiveIn(Organisation $organisation): array
    {
        return $this->findBy(['organisation' => $organisation, 'status' => MembershipStatus::Active], ['createdAt' => 'ASC', 'id' => 'ASC']);
    }

    /** @return list<Membership> the members with no Google or Apple linked, by name */
    public function findActiveWithoutProviderIn(Organisation $organisation): array
    {
        /** @var list<Membership> */
        return $this->createQueryBuilder('m')
            ->join('m.user', 'u')
            ->where('m.organisation = :organisation')
            ->andWhere('m.status = :active')
            ->andWhere('NOT EXISTS (SELECT 1 FROM ' . ProviderIdentity::class . ' p WHERE p.user = u)')
            ->setParameter('organisation', $organisation)
            ->setParameter('active', MembershipStatus::Active)
            ->orderBy('u.name', 'ASC')
            ->addOrderBy('m.id', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
