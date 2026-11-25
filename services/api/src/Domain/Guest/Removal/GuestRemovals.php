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
use App\Enum\ErrorCode;
use App\Enum\NotificationAudienceKind;
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

/** Remove from the list (sc-3774): their link works until the erasure; the audit entry is on the event, so nothing of theirs outlives it. A guest who has arrived, or whose companion has, stays (sc-1454): removing them would erase the arrival. */
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

    /** Refused 404 when they are not on the list, removed already by someone else included, and 409 `guest_arrived` when they or a companion have arrived, with `why`. */
    public function remove(Event $event, string $guestId, User $by): void
    {
        $this->entityManager->wrapInTransaction(function () use ($event, $guestId, $by): void {
            $guest = $this->locked($this->guestRepository->findHostOn($event, $guestId));

            if ($guest->isRemoved()) {
                throw ApiException::notFound('access.not_found');
            }

            $why = $this->whyStays($guest);

            if (null !== $why) {
                throw self::arrived([['id' => $guest->getId()->toRfc4122(), 'fullName' => $guest->getFullName(), 'why' => $why]]);
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
     * A guest who has arrived, or whose companion has, is left and named in `stayed`, and the rest are removed; refused 409 `guest_arrived` when every guest found stays (sc-1454).
     *
     * @param list<string> $guestIds
     */
    public function removeTogether(Event $event, array $guestIds, User $by): RemovedTogether
    {
        $removed = $this->entityManager->wrapInTransaction(function () use ($event, $guestIds, $by): RemovedTogether {
            $found = $this->guestRepository->lockHostsOn($event, $guestIds);

            if ([] === $found) {
                return new RemovedTogether(null, 0, 0, Iter\count(Vec\unique($guestIds)));
            }

            $stayed = Vec\filter_nulls(Vec\map($found, function (Guest $host): ?array {
                $why = $this->whyStays($host);

                return null === $why ? null : ['id' => $host->getId()->toRfc4122(), 'fullName' => $host->getFullName(), 'why' => $why];
            }));
            $staying = Vec\map($stayed, static fn (array $one): string => $one['id']);
            $hosts = Vec\filter($found, static fn (Guest $host): bool => !Iter\contains($staying, $host->getId()->toRfc4122()));

            if ([] === $hosts) {
                throw self::arrived($stayed);
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

            return new RemovedTogether($removal->toRfc4122(), Iter\count($hosts), $companions, Iter\count(Vec\unique($guestIds)) - Iter\count($found), $stayed);
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
        $people = Vec\map(Vec\flatten($parties), static fn (Guest $person): string => $person->getId()->toRfc4122());
        $this->connection->executeStatement(
            'UPDATE notification_deliveries SET address = NULL WHERE recipient_kind = :guest AND recipient_id IN (:ids)',
            ['guest' => NotificationAudienceKind::Guest->value, 'ids' => $people],
            ['ids' => ArrayParameterType::STRING],
        );
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

    /** @return 'arrived'|'companionArrived'|null their own arrival wins over a companion's */
    private function whyStays(Guest $host): ?string
    {
        return match (true) {
            $host->hasArrived() => 'arrived',
            Iter\any($this->guestRepository->findCompanionsOf($host), static fn (Guest $companion): bool => $companion->hasArrived()) => 'companionArrived',
            default => null,
        };
    }

    /** @param list<array{id: string, fullName: ?string, why: 'arrived'|'companionArrived'}> $stayed the message names the first */
    private static function arrived(array $stayed): ApiException
    {
        $why = $stayed[0]['why'] ?? 'arrived';

        return new ApiException(
            ErrorCode::GuestArrived,
            'arrived' === $why ? 'guest.arrived' : 'guest.companion_arrived',
            parameters: ['{name}' => $stayed[0]['fullName'] ?? ''],
            members: ['stayed' => $stayed, 'why' => $why],
        );
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
