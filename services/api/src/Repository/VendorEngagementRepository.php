<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\Vendor;
use App\Entity\VendorEngagement;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Dict;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<VendorEngagement> */
final class VendorEngagementRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, VendorEngagement::class);
    }

    public function loads(): string
    {
        return VendorEngagement::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?VendorEngagement
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id]);
    }

    /** @return list<VendorEngagement> in the order the vendors were first quoted */
    public function findOnEvent(Event $event): array
    {
        /** @var list<VendorEngagement> */
        return $this->createQueryBuilder('e')
            ->addSelect('v')
            ->join('e.vendor', 'v')
            ->where('e.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('e.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function findOf(Event $event, Vendor $vendor): ?VendorEngagement
    {
        return $this->findOneBy(['event' => $event, 'vendor' => $vendor]);
    }

    public function anyOnEvent(Event $event): bool
    {
        return null !== $this->findOneBy(['event' => $event]);
    }

    /**
     * @param list<Uuid> $vendorIds
     *
     * @return array<string, int> how many events engage each vendor, by its id; a vendor no event engages is left out
     */
    public function countEventsOf(array $vendorIds): array
    {
        if ([] === $vendorIds) {
            return [];
        }

        $rows = Type\vec(Type\shape(['vendor_id' => Type\string(), 'events' => Type\int()]))->coerce($this->getEntityManager()->getConnection()->fetchAllAssociative(
            'SELECT vendor_id, count(DISTINCT event_id) AS events FROM vendor_engagements WHERE vendor_id IN (:vendors) GROUP BY vendor_id',
            ['vendors' => Vec\map($vendorIds, static fn (Uuid $id): string => $id->toRfc4122())],
            ['vendors' => ArrayParameterType::STRING],
        ));

        return Dict\pull($rows, static fn (array $row): int => $row['events'], static fn (array $row): string => $row['vendor_id']);
    }

    /** @return list<Event> the events with a scheduled payment to the vendor, by name */
    public function eventsOwing(Vendor $vendor): array
    {
        /** @var list<Event> */
        return $this->getEntityManager()->createQuery(
            'SELECT ev FROM App\\Entity\\Event ev WHERE ev.id IN (SELECT IDENTITY(e.event) FROM App\\Entity\\ScheduledPayment p JOIN p.engagement e WHERE e.vendor = :vendor) ORDER BY ev.name ASC',
        )
            ->setParameter('vendor', $vendor->getId(), 'uuid')
            ->getResult();
    }
}
