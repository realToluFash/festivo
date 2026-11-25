<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\StaffMember;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Enum\EventStatus;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<StaffMember> */
final class StaffMemberRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, StaffMember::class);
    }

    public function loads(): string
    {
        return StaffMember::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?StaffMember
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id]);
    }

    /** @return list<StaffMember> the roster entries an account signed in through (sc-4235) that still hold a link, on events not yet closed */
    public function findSignedInAs(User $account, DateTimeImmutable $now, ?Uuid $eventId = null): array
    {
        $query = $this->createQueryBuilder('s')
            ->select('s', 'e')
            ->innerJoin('s.event', 'e')
            ->where('s.account = :account')
            ->andWhere('e.closesAt IS NULL OR e.closesAt > :now')
            ->andWhere('EXISTS (SELECT 1 FROM App\Entity\StaffLinkToken t WHERE t.staffMember = s)')
            ->setParameter('account', $account->getId(), 'uuid')
            ->setParameter('now', $now)
            ->orderBy('e.startsAtUtc', 'ASC')
            ->addOrderBy('s.id', 'ASC');

        if (null !== $eventId) {
            $query->andWhere('s.event = :event')->setParameter('event', $eventId, 'uuid');
        }

        /** @var list<StaffMember> */
        return $query->getQuery()->getResult();
    }

    /** @return list<StaffMember> in the order they were added; RosterOrder sorts them */
    public function findOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event], ['id' => 'ASC']);
    }

    /** @return list<StaffMember> on the station, as their own or as well (sc-3910) */
    public function findOnStation(StaffStation $station): array
    {
        /** @var list<StaffMember> */
        return $this->createQueryBuilder('s')
            ->where('s.station = :station OR s.asWellStation = :station')
            ->setParameter('station', $station)
            ->getQuery()
            ->getResult();
    }

    /** @return list<StaffMember> not yet erased, on events finished at or before `$cutoff` */
    public function findContactsDue(DateTimeImmutable $cutoff): array
    {
        /** @var list<StaffMember> */
        return $this->createQueryBuilder('s')
            ->innerJoin('s.event', 'e')
            ->where('s.contactsErasedAt IS NULL')
            ->andWhere('e.status <> :draft')
            ->andWhere('e.closesAt <= :cutoff')
            ->setParameter('draft', EventStatus::Draft)
            ->setParameter('cutoff', $cutoff->setTimezone(new DateTimeZone('UTC')))
            ->orderBy('e.id', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
