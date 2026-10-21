<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\ProviderIdentity;
use App\Entity\User;
use App\Enum\MembershipStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
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
        return $this->findActiveByUserId($user->getId(), $organisationId);
    }

    public function findActiveByUserId(Uuid $userId, Uuid $organisationId): ?Membership
    {
        /** @var ?Membership */
        return $this->active()
            ->andWhere('m.user = :user')
            ->andWhere('m.organisation = :organisation')
            ->setParameter('user', $userId, 'uuid')
            ->setParameter('organisation', $organisationId, 'uuid')
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** @return list<Membership> oldest first, so the organisation somebody founded leads */
    public function findActiveFor(User $user): array
    {
        /** @var list<Membership> */
        return $this->active()
            ->andWhere('m.user = :user')
            ->setParameter('user', $user)
            ->orderBy('m.createdAt', 'ASC')
            ->addOrderBy('m.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** @return list<Membership> in every state, oldest first */
    public function findInOrganisation(Organisation $organisation): array
    {
        return $this->findBy(['organisation' => $organisation], ['createdAt' => 'ASC', 'id' => 'ASC']);
    }

    /** Through a verified address only, as accepting counts: an unverified one proves nobody is that person. */
    public function findOneByAddress(Organisation $organisation, string $normalisedEmail): ?Membership
    {
        return $this->createQueryBuilder('m')
            ->join('m.user', 'u')
            ->join('u.emailAddresses', 'e')
            ->andWhere('m.organisation = :organisation')
            ->andWhere('e.address = :email')
            ->andWhere('e.verifiedAt IS NOT NULL')
            ->setParameter('organisation', $organisation)
            ->setParameter('email', $normalisedEmail)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** @return list<Membership> */
    public function findActiveIn(Organisation $organisation): array
    {
        /** @var list<Membership> */
        return $this->active()
            ->andWhere('m.organisation = :organisation')
            ->setParameter('organisation', $organisation)
            ->orderBy('m.createdAt', 'ASC')
            ->addOrderBy('m.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function countActiveIn(Organisation $organisation): int
    {
        return (int) $this->active()
            ->select('COUNT(m.id)')
            ->andWhere('m.organisation = :organisation')
            ->setParameter('organisation', $organisation)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /** @return list<Membership> in every state, in organisations that still exist */
    public function findAllFor(User $user): array
    {
        /** @var list<Membership> */
        return $this->createQueryBuilder('m')
            ->select('m', 'o')
            ->innerJoin('m.organisation', 'o')
            ->where('m.user = :user')
            ->setParameter('user', $user)
            ->orderBy('m.createdAt', 'ASC')
            ->addOrderBy('m.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** The organisation is joined so the soft-delete filter applies to it: a deleted one's members hold nothing (sc-68). */
    private function active(): QueryBuilder
    {
        return $this->createQueryBuilder('m')
            ->select('m', 'o')
            ->innerJoin('m.organisation', 'o')
            ->where('m.status = :active')
            ->setParameter('active', MembershipStatus::Active);
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
