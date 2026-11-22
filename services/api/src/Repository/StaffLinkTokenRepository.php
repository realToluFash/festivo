<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\StaffLinkToken;
use App\Entity\StaffMember;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Dict;
use Psl\Type;
use Psl\Vec;

/** @extends ServiceEntityRepository<StaffLinkToken> */
final class StaffLinkTokenRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, StaffLinkToken::class);
    }

    public function findOneByTokenHash(string $tokenHash): ?StaffLinkToken
    {
        return $this->findOneBy(['tokenHash' => $tokenHash]);
    }

    /** Every link the person was given, in one statement. */
    public function endAllOf(StaffMember $entry): void
    {
        $this->createQueryBuilder('t')
            ->delete()
            ->andWhere('t.staffMember = :entry')
            ->setParameter('entry', $entry->getId(), 'uuid')
            ->getQuery()
            ->execute();
    }

    /** @return array<string, bool> the people on the event holding at least one link, by id */
    public function holdersOn(Event $event): array
    {
        $ids = $this->createQueryBuilder('t')
            ->select('DISTINCT IDENTITY(t.staffMember) AS id')
            ->join('t.staffMember', 's')
            ->andWhere('s.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->getQuery()
            ->getScalarResult();

        return Dict\from_keys(Vec\map($ids, static fn (mixed $row): string => Type\shape(['id' => Type\string()])->coerce($row)['id']), static fn (): bool => true);
    }
}
