<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\ScheduledPayment;
use App\Entity\VendorEngagement;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<ScheduledPayment> */
final class ScheduledPaymentRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ScheduledPayment::class);
    }

    public function loads(): string
    {
        return ScheduledPayment::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?ScheduledPayment
    {
        /** @var ?ScheduledPayment */
        return $this->createQueryBuilder('p')
            ->join('p.engagement', 'e')
            ->where('e.event = :event')
            ->andWhere('p.id = :id')
            ->setParameter('event', $eventId, 'uuid')
            ->setParameter('id', $id, 'uuid')
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** @return list<ScheduledPayment> by date due, then in the order they were added */
    public function findOnEvent(Event $event): array
    {
        /** @var list<ScheduledPayment> */
        return $this->createQueryBuilder('p')
            ->join('p.engagement', 'e')
            ->where('e.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('p.dueOn', 'ASC')
            ->addOrderBy('p.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** Paid ones and ones added as already made count; cancelled ones do not, as in what scheduled sums (sc-88). */
    public function hasScheduled(VendorEngagement $engagement): bool
    {
        return null !== $this->createQueryBuilder('p')
            ->select('1')
            ->where('p.engagement = :engagement')
            ->andWhere('p.cancelledAt IS NULL')
            ->setParameter('engagement', $engagement->getId(), 'uuid')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
