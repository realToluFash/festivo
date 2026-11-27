<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\ShiftAttendance;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<ShiftAttendance> */
final class ShiftAttendanceRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ShiftAttendance::class);
    }

    public function findOneOn(StaffShift $shift, StaffMember $person): ?ShiftAttendance
    {
        return $this->findOneBy(['shift' => $shift, 'staffMember' => $person]);
    }

    /** A row whose person has left the roster, by the id their entry had. */
    public function findOneRemovedOn(StaffShift $shift, string $personId): ?ShiftAttendance
    {
        return Uuid::isValid($personId) ? $this->findOneBy(['shift' => $shift, 'personId' => Uuid::fromString($personId), 'staffMember' => null]) : null;
    }

    /**
     * Including the rows of people since removed from the roster.
     *
     * @return list<ShiftAttendance>
     */
    public function findOnEvent(Event $event): array
    {
        /** @var list<ShiftAttendance> */
        return $this->createQueryBuilder('a')
            ->innerJoin('a.shift', 's')
            ->innerJoin('s.job', 'j')
            ->where('j.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->getQuery()
            ->getResult();
    }

    /** Whether anyone has a clock-in on any of the job's shifts, recorded or entered as a correction (Decided, 26 Nov). */
    public function anyWorkedInJob(StaffJob $job): bool
    {
        return [] !== $this->createQueryBuilder('a')
            ->select('a.id')
            ->innerJoin('a.shift', 's')
            ->where('s.job = :job')
            ->andWhere('a.clockedInAt IS NOT NULL OR a.correctedInAt IS NOT NULL')
            ->setParameter('job', $job->getId(), 'uuid')
            ->setMaxResults(1)
            ->getQuery()
            ->getResult();
    }

    /** @return list<ShiftAttendance> */
    public function findOfPerson(StaffMember $person): array
    {
        return $this->findBy(['staffMember' => $person]);
    }

    /**
     * Clocked in and not yet out, on the roster entries the account signed in through by their link, or holds on a join code's shift (sc-234); whether a clock-out is still taken is the caller's to work out.
     *
     * @return list<ShiftAttendance>
     */
    public function findOpenOfAccount(User $account, ?Uuid $eventId = null): array
    {
        $query = $this->createQueryBuilder('a')
            ->select('a', 'p', 's')
            ->innerJoin('a.staffMember', 'p')
            ->innerJoin('a.shift', 's')
            ->where('p.account = :account')
            ->andWhere('a.clockedInAt IS NOT NULL OR a.correctedInAt IS NOT NULL')
            ->andWhere('a.clockedOutAt IS NULL AND a.correctedOutAt IS NULL')
            ->andWhere('EXISTS (SELECT 1 FROM App\Entity\StaffLinkToken t WHERE t.staffMember = p) OR EXISTS (SELECT 1 FROM App\Entity\EventPerson ep INNER JOIN ep.doorCode dc WHERE ep.user = p.account AND ep.event = p.event AND dc.shift = s)')
            ->setParameter('account', $account->getId(), 'uuid')
            ->orderBy('a.clockedInAt', 'ASC');

        if (null !== $eventId) {
            $query->andWhere('p.event = :event')->setParameter('event', $eventId, 'uuid');
        }

        /** @var list<ShiftAttendance> */
        return $query->getQuery()->getResult();
    }
}
