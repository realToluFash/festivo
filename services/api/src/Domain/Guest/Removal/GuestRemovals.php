<?php

declare(strict_types=1);

namespace App\Domain\Guest\Removal;

use App\Audit\Auditor;
use App\Domain\Guest\GuestListPublisher;
use App\Domain\Guest\Model\RemovedTogether;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\Actor;
use App\Http\Exception\ApiException;
use App\Repository\GuestRepository;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** Remove from the list (sc-3774): their link works until the erasure; the audit entry is on the event, so nothing of theirs outlives it. */
final readonly class GuestRemovals
{
    public const string REMOVED = 'guest.removed';

    public const string REMOVED_TOGETHER = 'guests.removed_together';

    public const string LAPSE = 'PT15M';

    public function __construct(
        private GuestRepository $guestRepository,
        private EntityManagerInterface $entityManager,
        private Connection $connection,
        private Auditor $auditor,
        private GuestListPublisher $guestListPublisher,
        private ClockInterface $clock,
    ) {
    }

    /** Refused 404 when they are not on the list, removed already by someone else included. */
    public function remove(Event $event, string $guestId, User $by): void
    {
        $this->entityManager->wrapInTransaction(function () use ($event, $guestId, $by): void {
            $guest = $this->locked($this->guestRepository->findHostOn($event, $guestId));

            if ($guest->isRemoved()) {
                throw ApiException::notFound('access.not_found');
            }

            $at = $this->clock->now();

            foreach ($this->party($guest) as $person) {
                $person->remove($at, $by);
            }

            $this->entityManager->flush();
        });

        $this->guestListPublisher->publish($event);
    }

    /**
     * One action for many guests and their companions, all or nothing, with one Undo (sc-3776). An id not on the list is counted in `gone`, never refused.
     *
     * @param list<string> $guestIds
     */
    public function removeTogether(Event $event, array $guestIds, User $by): RemovedTogether
    {
        $removed = $this->entityManager->wrapInTransaction(function () use ($event, $guestIds, $by): RemovedTogether {
            $hosts = $this->guestRepository->lockHostsOn($event, $guestIds);

            if ([] === $hosts) {
                return new RemovedTogether(null, 0, 0, Iter\count(Vec\unique($guestIds)));
            }

            $at = $this->clock->now();
            $removal = Uuid::v7();
            $companions = 0;

            foreach ($hosts as $host) {
                $host->remove($at, $by, $removal);

                foreach ($this->guestRepository->findCompanionsOf($host) as $companion) {
                    $companion->remove($at, $by);
                    ++$companions;
                }
            }

            $this->entityManager->flush();

            return new RemovedTogether($removal->toRfc4122(), Iter\count($hosts), $companions, Iter\count(Vec\unique($guestIds)) - Iter\count($hosts));
        });

        if (null !== $removed->removalId) {
            $this->guestListPublisher->publish($event);
        }

        return $removed;
    }

    /** Refused 404 once erased. */
    public function undoTogether(Event $event, string $removalId): int
    {
        $undone = $this->entityManager->wrapInTransaction(function () use ($event, $removalId): int {
            $hosts = $this->guestRepository->lockRemovedTogether($event, $removalId);

            if ([] === $hosts) {
                throw ApiException::notFound('access.not_found');
            }

            foreach ($hosts as $host) {
                foreach ($this->party($host) as $person) {
                    $person->undoRemoval();
                }
            }

            $this->entityManager->flush();

            return Iter\count($hosts);
        });

        $this->guestListPublisher->publish($event);

        return $undone;
    }

    /** Refused 404 once undone or erased. */
    public function eraseTogether(Event $event, string $removalId): void
    {
        $this->entityManager->wrapInTransaction(function () use ($event, $removalId): void {
            $hosts = $this->guestRepository->lockRemovedTogether($event, $removalId);

            if ([] === $hosts) {
                throw ApiException::notFound('access.not_found');
            }

            $this->eraseNow($hosts, self::REMOVED_TOGETHER);
        });
    }

    /** Back in their place as they were; refused 404 once erased. */
    public function undo(Event $event, string $guestId): Guest
    {
        $guest = $this->entityManager->wrapInTransaction(function () use ($event, $guestId): Guest {
            $guest = $this->locked($this->guestRepository->findRemovedHostOn($event, $guestId));

            if (!$guest->isRemoved()) {
                throw ApiException::notFound('access.not_found');
            }

            foreach ($this->party($guest) as $person) {
                $person->undoRemoval();
            }

            $this->entityManager->flush();

            return $guest;
        });

        $this->guestListPublisher->publish($event);

        return $guest;
    }

    /** Refused 404 when they were not removed, or have been erased already. */
    public function erase(Event $event, string $guestId): void
    {
        $this->entityManager->wrapInTransaction(function () use ($event, $guestId): void {
            $guest = $this->locked($this->guestRepository->findRemovedHostOn($event, $guestId));

            if (!$guest->isRemoved()) {
                throw ApiException::notFound('access.not_found');
            }

            $this->eraseNow([$guest], self::REMOVED);
        });
    }

    /** Those whose page never said their undo ran out, LAPSE after their removal. */
    public function eraseLapsed(): int
    {
        $cutoff = $this->clock->now()->sub(new DateInterval(self::LAPSE));
        $erased = 0;

        foreach ($this->guestRepository->findRemovedBefore($cutoff) as $guest) {
            $erased += $this->entityManager->wrapInTransaction(function () use ($guest, $cutoff): int {
                if (!$this->stillLapsed($guest, $cutoff)) {
                    return 0;
                }

                $removal = $guest->getRemovalId();

                if (null === $removal) {
                    $this->eraseNow([$guest], self::REMOVED);

                    return 1;
                }

                $together = $this->guestRepository->lockRemovedTogether($guest->getEvent(), $removal->toRfc4122());
                $this->eraseNow($together, self::REMOVED_TOGETHER);

                return Iter\count($together);
            });
        }

        return $erased;
    }

    /** @param list<Guest> $hosts their companions and needs go by the cascade; one audit entry, with the counts when removed together */
    private function eraseNow(array $hosts, string $action): void
    {
        if ([] === $hosts) {
            return;
        }

        $first = $hosts[0];
        $by = $first->getRemovedBy();
        $parties = Vec\map($hosts, $this->party(...));
        $changes = self::REMOVED_TOGETHER === $action ? [
            'guests' => [null, Iter\count($hosts)],
            'companions' => [null, Iter\count(Vec\flatten($parties)) - Iter\count($hosts)],
        ] : [];
        $this->auditor->record($action, 'Event', $first->getEvent()->getId(), null === $by ? Actor::System : Actor::User, $by?->getId(), $by?->getName(), changes: $changes, occurredAt: $first->getRemovedAt());
        $this->entityManager->flush();
        $this->connection->executeStatement('DELETE FROM guests WHERE id IN (:ids)', ['ids' => Vec\map($hosts, static fn (Guest $host): string => $host->getId()->toRfc4122())], ['ids' => ArrayParameterType::STRING]);

        foreach (Vec\flatten($parties) as $person) {
            $this->entityManager->detach($person);
        }
    }

    /** Undone, erased or removed again since the cron found them, they are left alone. */
    private function stillLapsed(Guest $guest, DateTimeImmutable $cutoff): bool
    {
        if (false === $this->connection->fetchOne('SELECT 1 FROM guests WHERE id = :id FOR UPDATE', ['id' => $guest->getId()->toRfc4122()])) {
            return false;
        }

        $this->entityManager->refresh($guest);
        $removedAt = $guest->getRemovedAt();

        return null !== $removedAt && $removedAt <= $cutoff;
    }

    private function locked(?Guest $guest): Guest
    {
        if (null === $guest) {
            throw ApiException::notFound('access.not_found');
        }

        $this->entityManager->refresh($guest, LockMode::PESSIMISTIC_WRITE);

        return $guest;
    }

    /** @return list<Guest> */
    private function party(Guest $guest): array
    {
        return [$guest, ...Vec\values($this->guestRepository->findCompanionsOf($guest))];
    }
}
