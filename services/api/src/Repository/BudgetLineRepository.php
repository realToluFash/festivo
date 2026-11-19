<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\BudgetLine;
use App\Entity\Event;
use App\Enum\CostBasis;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<BudgetLine> */
final class BudgetLineRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, BudgetLine::class);
    }

    public function loads(): string
    {
        return BudgetLine::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?BudgetLine
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id, 'removedAt' => null]);
    }

    /** Locked, so call it inside the transaction that puts it back. */
    public function findRemovedInEvent(Event $event, string $id): ?BudgetLine
    {
        if (!Uuid::isValid($id)) {
            return null;
        }

        /** @var ?BudgetLine */
        return $this->createQueryBuilder('b')
            ->where('b.event = :event')
            ->andWhere('b.id = :id')
            ->andWhere('b.removedAt IS NOT NULL')
            ->setParameter('event', $event->getId(), 'uuid')
            ->setParameter('id', Uuid::fromString($id), 'uuid')
            ->getQuery()
            ->setLockMode(LockMode::PESSIMISTIC_WRITE)
            ->getOneOrNullResult();
    }

    /** @return list<BudgetLine> in the order they were added, which is their place in their category */
    public function findOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event, 'removedAt' => null], ['id' => 'ASC']);
    }

    /** A removed line counts in no figure, so it does not hold the event's currency (sc-85, decided 19 Nov, #72668). */
    public function anyOnEvent(Event $event): bool
    {
        return null !== $this->findOneBy(['event' => $event, 'removedAt' => null]);
    }

    /** Their prices are in the currency the event had, so their Undo is refused from now on, and nothing written or priced on them is kept (sc-85, decided 19 Nov, #72947). */
    public function markRemovedPastCurrency(Event $event): void
    {
        $this->getEntityManager()
            ->createQuery('UPDATE App\\Entity\\BudgetLine b SET b.currencyChanged = true, b.label = NULL, b.priceMinor = NULL, b.note = NULL WHERE b.event = :event AND b.removedAt IS NOT NULL')
            ->setParameter('event', $event->getId(), 'uuid')
            ->execute();
    }

    public function findStaffLine(Event $event): ?BudgetLine
    {
        return $this->findOneBy(['event' => $event, 'basis' => CostBasis::PerStaffHour, 'removedAt' => null]);
    }

    /** Removed lines nobody put back by the cutoff, gone for good; a line put back meanwhile holds its row lock, so this waits and leaves it. */
    public function eraseRemovedBefore(DateTimeImmutable $cutoff): int
    {
        $erased = $this->getEntityManager()
            ->createQuery('DELETE FROM App\\Entity\\BudgetLine b WHERE b.removedAt <= :cutoff')
            ->setParameter('cutoff', $cutoff, 'datetime_immutable')
            ->execute();

        return \is_int($erased) ? $erased : 0;
    }
}
