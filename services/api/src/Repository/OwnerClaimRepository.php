<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Organisation;
use App\Entity\OwnerClaim;
use App\Entity\User;
use App\Enum\OwnerClaimOutcome;
use DateInterval;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<OwnerClaim> */
final class OwnerClaimRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, OwnerClaim::class);
    }

    public function findOpenIn(Organisation $organisation): ?OwnerClaim
    {
        return $this->findOneBy(['organisation' => $organisation, 'endedAt' => null]);
    }

    /** One stop closes the way for good (sc-6640). */
    public function findStopIn(Organisation $organisation): ?OwnerClaim
    {
        return $this->findOneBy(['organisation' => $organisation, 'outcome' => OwnerClaimOutcome::Stopped], ['endedAt' => 'DESC', 'id' => 'DESC']);
    }

    public function findLastBy(User $claimant, Organisation $organisation): ?OwnerClaim
    {
        return $this->findOneBy(['organisation' => $organisation, 'claimant' => $claimant], ['startedAt' => 'DESC', 'id' => 'DESC']);
    }

    /** @return list<OwnerClaim> open claims with something due: passing, lapsing, or an hourly look-up, the earliest first */
    public function findDue(DateTimeImmutable $now, ?Organisation $organisation = null): array
    {
        $query = $this->createQueryBuilder('c')
            ->select('c', 'o')
            ->innerJoin('c.organisation', 'o')
            ->where('c.endedAt IS NULL')
            ->andWhere('c.passesAt <= :now OR (c.foundAt IS NULL AND (c.lapsesAt <= :now OR c.checkedAt IS NULL OR c.checkedAt <= :checkBefore))')
            ->setParameter('now', $now, Types::DATETIME_IMMUTABLE)
            ->setParameter('checkBefore', $now->sub(new DateInterval(OwnerClaim::CHECKED_EVERY)), Types::DATETIME_IMMUTABLE)
            ->orderBy('c.startedAt', 'ASC')
            ->addOrderBy('c.id', 'ASC');

        if (null !== $organisation) {
            $query->andWhere('c.organisation = :organisation')->setParameter('organisation', $organisation);
        }

        /** @var list<OwnerClaim> */
        return $query->getQuery()->getResult();
    }
}
