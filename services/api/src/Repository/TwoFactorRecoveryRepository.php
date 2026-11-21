<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Membership;
use App\Entity\TwoFactorRecovery;
use App\Entity\TwoFactorRecoveryHandle;
use App\Entity\User;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Enum\TwoFactorRecoveryStatus;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Psl\Vec;

/** @extends ServiceEntityRepository<TwoFactorRecovery> */
final class TwoFactorRecoveryRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TwoFactorRecovery::class);
    }

    /** The request a device's handle holds, by the handle's hash. */
    public function findOneByHandle(string $tokenHash): ?TwoFactorRecovery
    {
        $handle = $this->getEntityManager()->getRepository(TwoFactorRecoveryHandle::class)->findOneBy(['tokenHash' => $tokenHash]);

        return $handle?->getRecovery();
    }

    /** @return list<TwoFactorRecovery> still being proved, or waiting on an answer */
    public function findOpenFor(User $user): array
    {
        return $this->findBy(
            ['user' => $user, 'status' => [TwoFactorRecoveryStatus::Proving, TwoFactorRecoveryStatus::Waiting]],
            ['createdAt' => 'DESC'],
        );
    }

    /** @return list<DateTimeImmutable> when each request since then was started, oldest first */
    public function startedSince(User $user, DateTimeImmutable $since): array
    {
        $rows = $this->createQueryBuilder('r')
            ->select('r.createdAt')
            ->where('r.user = :user')
            ->andWhere('r.createdAt > :since')
            ->setParameter('user', $user)
            ->setParameter('since', $since)
            ->orderBy('r.createdAt', 'ASC')
            ->getQuery()
            ->getArrayResult();

        return Vec\map(
            Type\vec(Type\shape(['createdAt' => Type\instance_of(DateTimeImmutable::class)]))->coerce($rows),
            static fn (array $row): DateTimeImmutable => $row['createdAt'],
        );
    }

    /**
     * Waiting requests from members of an organisation the approver may answer for, theirs included.
     *
     * @param list<SeededRole> $roles
     *
     * @return list<TwoFactorRecovery>
     */
    public function findWaitingAnswerableBy(User $approver, array $roles, DateTimeImmutable $now): array
    {
        return $this->createQueryBuilder('r')
            ->innerJoin(Membership::class, 'theirs', 'WITH', 'theirs.user = r.user AND theirs.status = :active')
            ->innerJoin(Membership::class, 'mine', 'WITH', 'mine.organisation = theirs.organisation AND mine.user = :approver AND mine.status = :active')
            ->innerJoin('mine.organisation', 'organisation')
            ->innerJoin('mine.role', 'role')
            ->where('r.status = :waiting')
            ->andWhere('r.expiresAt > :now')
            ->andWhere('role.seededAs IN (:roles)')
            ->setParameter('active', MembershipStatus::Active)
            ->setParameter('approver', $approver)
            ->setParameter('waiting', TwoFactorRecoveryStatus::Waiting)
            ->setParameter('now', $now)
            ->setParameter('roles', $roles)
            ->distinct()
            ->orderBy('r.provedAt', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** @return list<TwoFactorRecovery> */
    public function findWaitingExpiredBy(DateTimeImmutable $now): array
    {
        return $this->createQueryBuilder('r')
            ->where('r.status = :waiting')
            ->andWhere('r.expiresAt <= :now')
            ->setParameter('waiting', TwoFactorRecoveryStatus::Waiting)
            ->setParameter('now', $now)
            ->getQuery()
            ->getResult();
    }
}
