<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\GuestGroup;
use App\Entity\Organisation;
use App\Enum\EventStatus;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<Guest> */
final class GuestRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Guest::class);
    }

    public function loads(): string
    {
        return Guest::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?Guest
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id, 'removedAt' => null]);
    }

    /** @return list<Guest> hosts and companions alike, each companion in its place */
    public function findOnList(Event $event): array
    {
        /** @var list<Guest> */
        return $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->andWhere('g.removedAt IS NULL')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('g.position', 'ASC')
            ->addOrderBy('g.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @param list<Event> $events
     *
     * @return list<Guest> every list's hosts and companions, loaded together
     */
    public function findOnListsOf(array $events): array
    {
        if ([] === $events) {
            return [];
        }

        return $this->findBy(['event' => $events]);
    }

    /** @return list<Guest> the hosts in it; their companions follow them */
    public function findInGroup(GuestGroup $group): array
    {
        return $this->findBy(['group' => $group, 'removedAt' => null]);
    }

    /** Guests and companions together: the Guests header's N. */
    public function countPeople(Event $event): int
    {
        return Type\int()->coerce($this->createQueryBuilder('g')
            ->select('COUNT(g.id)')
            ->where('g.event = :event')
            ->andWhere('g.removedAt IS NULL')
            ->setParameter('event', $event->getId(), 'uuid')
            ->getQuery()
            ->getSingleScalarResult());
    }

    /** Guests and companions on every event the organisation still has. */
    public function countInOrganisation(Organisation $organisation): int
    {
        return Type\int()->coerce($this->createQueryBuilder('g')
            ->select('COUNT(g.id)')
            ->innerJoin('g.event', 'e')
            ->where('e.organisation = :organisation')
            ->andWhere('g.removedAt IS NULL')
            ->setParameter('organisation', $organisation->getId(), 'uuid')
            ->getQuery()
            ->getSingleScalarResult());
    }

    public function findOneNamed(Event $event, string $nameKey, ?Guest $other = null): ?Guest
    {
        $query = $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->andWhere('g.nameKey = :key')
            ->andWhere('g.removedAt IS NULL')
            ->setParameter('event', $event->getId(), 'uuid')
            ->setParameter('key', $nameKey)
            ->setMaxResults(1);

        if (null !== $other) {
            $query->andWhere('g.id <> :other')->setParameter('other', $other->getId(), 'uuid');
        }

        /** @var ?Guest */
        return $query->getQuery()->getOneOrNullResult();
    }

    /** A guest on the list, not a companion, and only on this event: anything else is not found. */
    public function findHostOn(Event $event, string $id): ?Guest
    {
        if (!Uuid::isValid($id)) {
            return null;
        }

        /** @var ?Guest */
        return $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->andWhere('g.host IS NULL')
            ->andWhere('g.id = :id')
            ->andWhere('g.removedAt IS NULL')
            ->setParameter('event', $event->getId(), 'uuid')
            ->setParameter('id', Uuid::fromString($id), 'uuid')
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** A guest of this event taken off the list and still inside their undo (sc-3774); once erased, or never removed, null. */
    public function findRemovedHostOn(Event $event, string $id): ?Guest
    {
        if (!Uuid::isValid($id)) {
            return null;
        }

        /** @var ?Guest */
        return $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->andWhere('g.host IS NULL')
            ->andWhere('g.id = :id')
            ->andWhere('g.removedAt IS NOT NULL')
            ->setParameter('event', $event->getId(), 'uuid')
            ->setParameter('id', Uuid::fromString($id), 'uuid')
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** @return list<Guest> hosts whose removal began at or before the cutoff and was never undone or erased */
    public function findRemovedBefore(DateTimeImmutable $cutoff): array
    {
        /** @var list<Guest> */
        return $this->createQueryBuilder('g')
            ->where('g.host IS NULL')
            ->andWhere('g.removedAt <= :cutoff')
            ->setParameter('cutoff', $cutoff, 'datetime_immutable')
            ->getQuery()
            ->getResult();
    }

    /**
     * Hosts on the list among these ids, locked for the action that acts on them; any other id is not a guest it can act on (sc-3776).
     *
     * @param list<string> $ids
     *
     * @return list<Guest>
     */
    public function lockHostsOn(Event $event, array $ids): array
    {
        $valid = Vec\filter($ids, Uuid::isValid(...));

        if ([] === $valid) {
            return [];
        }

        /** @var list<Guest> */
        return $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->andWhere('g.host IS NULL')
            ->andWhere('g.removedAt IS NULL')
            ->andWhere('g.id IN (:ids)')
            ->setParameter('event', $event->getId(), 'uuid')
            ->setParameter('ids', Vec\map($valid, static fn (string $id): string => Uuid::fromString($id)->toRfc4122()))
            ->orderBy('g.position', 'ASC')
            ->addOrderBy('g.id', 'ASC')
            ->getQuery()
            ->setLockMode(LockMode::PESSIMISTIC_WRITE)
            ->getResult();
    }

    /** @return list<Guest> the hosts one many-guest removal took, locked, in their places */
    public function lockRemovedTogether(Event $event, string $removalId): array
    {
        if (!Uuid::isValid($removalId)) {
            return [];
        }

        /** @var list<Guest> */
        return $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->andWhere('g.host IS NULL')
            ->andWhere('g.removalId = :removal')
            ->andWhere('g.removedAt IS NOT NULL')
            ->setParameter('event', $event->getId(), 'uuid')
            ->setParameter('removal', Uuid::fromString($removalId), 'uuid')
            ->orderBy('g.position', 'ASC')
            ->addOrderBy('g.id', 'ASC')
            ->getQuery()
            ->setLockMode(LockMode::PESSIMISTIC_WRITE)
            ->getResult();
    }

    /** @return list<Guest> in their places under the host */
    public function findCompanionsOf(Guest $host): array
    {
        /** @var list<Guest> */
        return $this->createQueryBuilder('g')
            ->where('g.host = :host')
            ->setParameter('host', $host->getId(), 'uuid')
            ->orderBy('g.position', 'ASC')
            ->addOrderBy('g.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** Only through an event that is neither deleted nor a Draft, so their links answer as unknown ones and a restore brings them back (sc-1526, sc-3591). */
    public function findOneByLink(#[SensitiveParameter] string $token): ?Guest
    {
        /** @var ?Guest */
        return $this->createQueryBuilder('g')
            ->innerJoin('g.event', 'e')
            ->where('g.linkToken = :token')
            ->andWhere('g.host IS NULL')
            ->andWhere('e.deletedAt IS NULL')
            ->andWhere('e.status != :draft')
            ->setParameter('token', $token)
            ->setParameter('draft', EventStatus::Draft->value)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** As findOneByLink, and also on a deleted event, which the guest's calendar shows as cancelled until its restore window closes (sc-3627). */
    public function findOneForCalendar(#[SensitiveParameter] string $token): ?Guest
    {
        $filters = $this->getEntityManager()->getFilters();
        $filtered = $filters->isEnabled('soft_delete');

        if ($filtered) {
            $filters->disable('soft_delete');
        }

        try {
            /** @var ?Guest */
            return $this->createQueryBuilder('g')
                ->innerJoin('g.event', 'e')
                ->addSelect('e')
                ->where('g.linkToken = :token')
                ->andWhere('g.host IS NULL')
                ->andWhere('e.status != :draft')
                ->setParameter('token', $token)
                ->setParameter('draft', EventStatus::Draft->value)
                ->getQuery()
                ->getOneOrNullResult();
        } finally {
            if ($filtered) {
                $filters->enable('soft_delete');
            }
        }
    }

    /** The guests whose link someone said reached the wrong person, for the hosts' notice (sc-1526). @return list<Guest> */
    public function findFlagged(Event $event): array
    {
        /** @var list<Guest> */
        return $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->andWhere('g.linkFlagged = true')
            ->andWhere('g.removedAt IS NULL')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('g.position', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
