<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\StaffMember;
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

    /** @return list<StaffMember> in the order they were added; RosterOrder sorts them */
    public function findOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event], ['id' => 'ASC']);
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
