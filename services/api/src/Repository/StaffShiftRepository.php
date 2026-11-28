<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<StaffShift> */
final class StaffShiftRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, StaffShift::class);
    }

    public function loads(): string
    {
        return StaffShift::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?StaffShift
    {
        /** @var ?StaffShift */
        return $this->createQueryBuilder('s')
            ->innerJoin('s.job', 'j')
            ->where('j.event = :event')
            ->andWhere('s.id = :id')
            ->setParameter('event', $eventId)
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** @return list<StaffShift> by start, then end */
    public function findOnEvent(Event $event): array
    {
        /** @var list<StaffShift> */
        return $this->createQueryBuilder('s')
            ->addSelect('p')
            ->innerJoin('s.job', 'j')
            ->leftJoin('s.people', 'p')
            ->where('j.event = :event')
            ->setParameter('event', $event->getId())
            ->orderBy('s.startsAt', 'ASC')
            ->addOrderBy('s.endsAt', 'ASC')
            ->addOrderBy('s.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** @return list<StaffShift> by start */
    public function findOfJob(StaffJob $job): array
    {
        return $this->findBy(['job' => $job], ['startsAt' => 'ASC', 'endsAt' => 'ASC']);
    }

    /** @return list<StaffShift> by start */
    public function findOfPerson(StaffMember $person): array
    {
        /** @var list<StaffShift> */
        return $this->createQueryBuilder('s')
            ->innerJoin('s.people', 'p')
            ->where('p = :person')
            ->setParameter('person', $person->getId())
            ->orderBy('s.startsAt', 'ASC')
            ->addOrderBy('s.endsAt', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
