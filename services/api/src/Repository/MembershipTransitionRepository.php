<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\MembershipTransition;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\MembershipStatus;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<MembershipTransition> */
final class MembershipTransitionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MembershipTransition::class);
    }

    /** @return list<MembershipTransition> every member's history in one read, oldest first */
    public function findInOrganisation(Organisation $organisation): array
    {
        return $this->createQueryBuilder('t')
            ->join('t.membership', 'm')
            ->andWhere('m.organisation = :organisation')
            ->setParameter('organisation', $organisation)
            ->orderBy('t.occurredAt', 'ASC')
            ->addOrderBy('t.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * A request ended by somebody else or by nobody, which is turned down or expired (sc-392); one the person withdrew is not.
     *
     * @return list<MembershipTransition>
     */
    public function findRequestsEndedForSince(User $user, DateTimeImmutable $since): array
    {
        return $this->createQueryBuilder('t')
            ->select('t', 'm')
            ->join('t.membership', 'm')
            ->andWhere('m.user = :user')
            ->andWhere('t.fromStatus = :pending')
            ->andWhere('t.toStatus = :gone')
            ->andWhere('t.actor IS NULL OR t.actor <> :user')
            ->andWhere('t.occurredAt >= :since')
            ->setParameter('user', $user)
            ->setParameter('pending', MembershipStatus::PendingApproval)
            ->setParameter('gone', MembershipStatus::LeftOrRemoved)
            ->setParameter('since', $since)
            ->getQuery()
            ->getResult();
    }
}
