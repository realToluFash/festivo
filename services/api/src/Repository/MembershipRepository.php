<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\ProviderIdentity;
use App\Entity\TwoFactorFactor;
use App\Entity\User;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Types\Types;
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

    /**
     * The active members tied to a domain (sc-564), in one organisation or in every other.
     *
     * @return list<Membership>
     */
    public function findActiveAtDomain(string $domain, Organisation $organisation, bool $elsewhere = false): array
    {
        /** @var list<Membership> */
        return $this->active()
            ->andWhere('m.domain = :domain')
            ->andWhere($elsewhere ? 'm.organisation <> :organisation' : 'm.organisation = :organisation')
            ->setParameter('domain', $domain)
            ->setParameter('organisation', $organisation)
            ->orderBy('m.createdAt', 'ASC')
            ->addOrderBy('m.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** @return list<Membership> the active owners and administrators, who hear about a suspension (sc-564) */
    public function findAdministratorsIn(Organisation $organisation): array
    {
        /** @var list<Membership> */
        return $this->active()
            ->innerJoin('m.role', 'r')
            ->andWhere('m.organisation = :organisation')
            ->andWhere('r.seededAs IN (:administrators)')
            ->setParameter('organisation', $organisation)
            ->setParameter('administrators', [SeededRole::Owner->value, SeededRole::Administrator->value])
            ->orderBy('m.createdAt', 'ASC')
            ->addOrderBy('m.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** @return list<Membership> suspended at or before the cutoff, oldest first */
    public function findSuspendedSince(DateTimeImmutable $cutoff): array
    {
        /** @var list<Membership> */
        return $this->createQueryBuilder('m')
            ->select('m', 'o')
            ->innerJoin('m.organisation', 'o')
            ->where('m.status = :suspended')
            ->andWhere('m.suspendedAt <= :cutoff')
            ->setParameter('suspended', MembershipStatus::Suspended)
            ->setParameter('cutoff', $cutoff, Types::DATETIME_IMMUTABLE)
            ->orderBy('m.suspendedAt', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** @return list<Membership> the caller's own suspended ones, in organisations that still exist */
    public function findSuspendedFor(User $user): array
    {
        /** @var list<Membership> */
        return $this->createQueryBuilder('m')
            ->select('m', 'o')
            ->innerJoin('m.organisation', 'o')
            ->where('m.user = :user')
            ->andWhere('m.status = :suspended')
            ->setParameter('user', $user)
            ->setParameter('suspended', MembershipStatus::Suspended)
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

    /** @return list<Membership> the active members with no two-factor on, by name (sc-609) */
    public function findActiveWithoutTwoFactorIn(Organisation $organisation): array
    {
        /** @var list<Membership> */
        return $this->createQueryBuilder('m')
            ->join('m.user', 'u')
            ->where('m.organisation = :organisation')
            ->andWhere('m.status = :active')
            ->andWhere('NOT EXISTS (SELECT 1 FROM ' . TwoFactorFactor::class . ' f WHERE f.user = u AND f.activatedAt IS NOT NULL)')
            ->setParameter('organisation', $organisation)
            ->setParameter('active', MembershipStatus::Active)
            ->orderBy('u.name', 'ASC')
            ->addOrderBy('m.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** @return list<Membership> active, past the deadline for two-factor of everyone, still without it, and not yet recorded as held back (sc-609) */
    public function findHeldForTwoFactorUnrecorded(DateTimeImmutable $graceStartedBefore): array
    {
        /** @var list<Membership> */
        return $this->active()
            ->join('m.user', 'u')
            ->andWhere('o.twoFactorRequiredSince <= :before')
            ->andWhere('m.joinedAt <= :before')
            ->andWhere('m.twoFactorBlockedAt IS NULL')
            ->andWhere('NOT EXISTS (SELECT 1 FROM ' . TwoFactorFactor::class . ' f WHERE f.user = u AND f.activatedAt IS NOT NULL)')
            ->setParameter('before', $graceStartedBefore)
            ->getQuery()
            ->getResult();
    }

    /** Switching the rule on or off starts the record of who it held back afresh (sc-609). */
    public function forgetTwoFactorBlocks(Organisation $organisation): void
    {
        $this->createQueryBuilder('m')
            ->update()
            ->set('m.twoFactorBlockedAt', 'NULL')
            ->where('m.organisation = :organisation')
            ->setParameter('organisation', $organisation)
            ->getQuery()
            ->execute();
    }
}
