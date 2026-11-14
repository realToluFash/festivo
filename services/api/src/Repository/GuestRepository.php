<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\GuestGroup;
use App\Entity\Organisation;
use App\Enum\EventStatus;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
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
        return $this->findOneBy(['event' => $eventId, 'id' => $id]);
    }

    /** @return list<Guest> hosts and companions alike, each companion in its place */
    public function findOnList(Event $event): array
    {
        /** @var list<Guest> */
        return $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('g.position', 'ASC')
            ->addOrderBy('g.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** @return list<Guest> the hosts in it; their companions follow them */
    public function findInGroup(GuestGroup $group): array
    {
        return $this->findBy(['group' => $group]);
    }

    /** Guests and companions together: the Guests header's N. */
    public function countPeople(Event $event): int
    {
        return Type\int()->coerce($this->createQueryBuilder('g')
            ->select('COUNT(g.id)')
            ->where('g.event = :event')
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
            ->setParameter('organisation', $organisation->getId(), 'uuid')
            ->getQuery()
            ->getSingleScalarResult());
    }

    public function findOneNamed(Event $event, string $nameKey, ?Guest $other = null): ?Guest
    {
        $query = $this->createQueryBuilder('g')
            ->where('g.event = :event')
            ->andWhere('g.nameKey = :key')
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
            ->setParameter('event', $event->getId(), 'uuid')
            ->setParameter('id', Uuid::fromString($id), 'uuid')
            ->getQuery()
            ->getOneOrNullResult();
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
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('g.position', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
