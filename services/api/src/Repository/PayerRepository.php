<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\Payer;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<Payer> */
final class PayerRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Payer::class);
    }

    public function loads(): string
    {
        return Payer::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?Payer
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id, 'removedAt' => null]);
    }

    /** Removed ones too, so a refusal can name somebody removed while a form was open. */
    public function findAnyInEvent(Event $event, string $id): ?Payer
    {
        return Uuid::isValid($id) ? $this->findOneBy(['event' => $event, 'id' => Uuid::fromString($id)]) : null;
    }

    /** Locked, so call it inside the transaction that puts it back. */
    public function findRemovedInEvent(Event $event, string $id): ?Payer
    {
        if (!Uuid::isValid($id)) {
            return null;
        }

        /** @var ?Payer */
        return $this->createQueryBuilder('p')
            ->where('p.event = :event')
            ->andWhere('p.id = :id')
            ->andWhere('p.removedAt IS NOT NULL')
            ->setParameter('event', $event->getId(), 'uuid')
            ->setParameter('id', Uuid::fromString($id), 'uuid')
            ->getQuery()
            ->setLockMode(LockMode::PESSIMISTIC_WRITE)
            ->getOneOrNullResult();
    }

    /** @return list<Payer> in the order they were added */
    public function findOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event, 'removedAt' => null], ['id' => 'ASC']);
    }

    public function eraseRemovedBefore(DateTimeImmutable $cutoff): int
    {
        $erased = $this->getEntityManager()
            ->createQuery('DELETE FROM App\\Entity\\Payer p WHERE p.removedAt <= :cutoff')
            ->setParameter('cutoff', $cutoff, 'datetime_immutable')
            ->execute();

        return \is_int($erased) ? $erased : 0;
    }
}
