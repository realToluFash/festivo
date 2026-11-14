<?php

declare(strict_types=1);

namespace App\Domain\Guest\Removal;

use App\Audit\Auditor;
use App\Domain\Guest\GuestListPublisher;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\Actor;
use App\Http\Exception\ApiException;
use App\Repository\GuestRepository;
use DateInterval;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** Remove from the list (sc-3774): their link works until the erasure; the audit entry is on the event, so nothing of theirs outlives it. */
final readonly class GuestRemovals
{
    public const string REMOVED = 'guest.removed';

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

            $this->eraseNow($guest);
        });
    }

    /** Those whose page never said their undo ran out, LAPSE after their removal. */
    public function eraseLapsed(): int
    {
        $cutoff = $this->clock->now()->sub(new DateInterval(self::LAPSE));
        $erased = 0;

        foreach ($this->guestRepository->findRemovedBefore($cutoff) as $guest) {
            $this->entityManager->wrapInTransaction(function () use ($guest): void {
                $this->eraseNow($guest);
            });
            ++$erased;
        }

        return $erased;
    }

    /** Their companions and needs go by the foreign keys' cascade. */
    private function eraseNow(Guest $guest): void
    {
        $by = $guest->getRemovedBy();
        $party = $this->party($guest);
        $this->auditor->record(self::REMOVED, 'Event', $guest->getEvent()->getId(), null === $by ? Actor::System : Actor::User, $by?->getId(), $by?->getName());
        $this->entityManager->flush();
        $this->connection->executeStatement('DELETE FROM guests WHERE id = :id', ['id' => $guest->getId()->toRfc4122()]);

        foreach ($party as $person) {
            $this->entityManager->detach($person);
        }
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
