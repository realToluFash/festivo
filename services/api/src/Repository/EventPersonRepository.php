<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\User;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<EventPerson> */
final class EventPersonRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, EventPerson::class);
    }

    public function loads(): string
    {
        return EventPerson::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?EventPerson
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id]);
    }

    public function findOneOn(Uuid $eventId, Membership $membership): ?EventPerson
    {
        return $this->findOneBy(['event' => $eventId, 'membership' => $membership]);
    }

    /** @return list<EventPerson> members and people from outside together, by name, with those not joined yet last */
    public function findOnEvent(Uuid $eventId): array
    {
        /** @var list<EventPerson> */
        return $this->createQueryBuilder('p')
            ->select('p', 'm', 'mu', 'ou')
            ->addSelect('COALESCE(mu.name, ou.name, p.address) AS HIDDEN shownAs')
            ->leftJoin('p.membership', 'm')
            ->leftJoin('m.user', 'mu')
            ->leftJoin('p.user', 'ou')
            ->where('p.event = :event')
            ->setParameter('event', $eventId, 'uuid')
            ->orderBy('shownAs', 'ASC')
            ->addOrderBy('p.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** Someone from outside on the event by their account, whether or not the event is over. */
    public function findOneOutside(Uuid $eventId, User $user): ?EventPerson
    {
        return $this->findOneBy(['event' => $eventId, 'user' => $user]);
    }

    public function findOneByAddress(Uuid $eventId, string $address): ?EventPerson
    {
        return $this->findOneBy(['event' => $eventId, 'address' => $address]);
    }

    /** A grant to someone from outside, on an event that has not concluded: the only kind that lets them in (sc-71). */
    public function findLiveOutside(Uuid $eventId, User $user, DateTimeImmutable $now): ?EventPerson
    {
        /** @var EventPerson|null */
        return $this->createQueryBuilder('p')
            ->innerJoin('p.event', 'e')
            ->where('p.event = :event')
            ->andWhere('p.user = :user')
            ->andWhere('e.closesAt > :now')
            ->setParameter('event', $eventId, 'uuid')
            ->setParameter('user', $user->getId(), 'uuid')
            ->setParameter('now', $now)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** @return list<EventPerson> every live grant the account holds from outside, soonest event first, then the grant made first: the first is where it lands */
    public function findLiveOutsideFor(User $user, DateTimeImmutable $now): array
    {
        /** @var list<EventPerson> */
        return $this->createQueryBuilder('p')
            ->select('p', 'e')
            ->innerJoin('p.event', 'e')
            ->where('p.user = :user')
            ->andWhere('e.closesAt > :now')
            ->setParameter('user', $user->getId(), 'uuid')
            ->setParameter('now', $now)
            ->orderBy('e.startsAtUtc', 'ASC')
            ->addOrderBy('p.createdAt', 'ASC')
            ->addOrderBy('p.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @param list<string> $addresses normalised
     *
     * @return list<EventPerson> the grants still waiting for an account at one of them
     */
    public function findPendingAt(array $addresses): array
    {
        if ([] === $addresses) {
            return [];
        }

        /** @var list<EventPerson> */
        return $this->createQueryBuilder('p')
            ->where('p.address IN (:addresses)')
            ->setParameter('addresses', $addresses)
            ->getQuery()
            ->getResult();
    }

    /** @return list<EventPerson> grants to people from outside whose event has concluded */
    public function findOutsideConcludedBy(DateTimeImmutable $now): array
    {
        /** @var list<EventPerson> */
        return $this->createQueryBuilder('p')
            ->select('p', 'e')
            ->innerJoin('p.event', 'e')
            ->where('p.membership IS NULL')
            ->andWhere('e.closesAt <= :now')
            ->setParameter('now', $now)
            ->getQuery()
            ->getResult();
    }

    /** @return list<EventPerson> */
    public function findFor(Membership $membership): array
    {
        return $this->findBy(['membership' => $membership]);
    }
}
