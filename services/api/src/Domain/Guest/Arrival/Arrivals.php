<?php

declare(strict_types=1);

namespace App\Domain\Guest\Arrival;

use App\Audit\Auditor;
use App\Domain\Guest\Interfaces\ArrivalFollowerInterface;
use App\Domain\Guest\Model\NewGuest;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\CheckInState;
use App\Enum\ClientKind;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Realtime\CheckInSignal;
use App\Repository\GuestRepository;
use Closure;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** A change at the door publishes only on the check-in topic, which says the list changed and nothing else: no name, reply or count reaches an ended grant, and every guest list and headcount re-reads on it (sc-28230, Decided 2 Nov). */
final readonly class Arrivals
{
    public const string ARRIVED = 'guest.arrived';

    public const string ARRIVAL_UNDONE = 'guest.arrival_undone';

    public const string WALKED_IN = 'guest.walked_in';

    public function __construct(
        private GuestRepository $guestRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private CheckInSignal $checkInSignal,
        private ClockInterface $clock,
        private ArrivalFollowerInterface $arrivalFollower,
    ) {
    }

    /** A guest or companion, each on their own; one already arrived keeps their first arrival and nothing is refused. `$recordedAt` is when a device that was offline recorded it (sc-1301): the door must have been open then, and a time after now is taken as now. */
    public function arrive(Event $event, string $personId, User $by, string $device, ClientKind $client, ?DateTimeImmutable $recordedAt = null): Guest
    {
        return $this->followed($event, $personId, $by, $device, $client, static fn (Guest $person, DateTimeImmutable $now): bool => $person->arrive(null === $recordedAt || $recordedAt > $now ? $now : $recordedAt, $by), self::ARRIVED, $recordedAt);
    }

    /** Asks nothing first; one not arrived is left as they are. */
    public function undo(Event $event, string $personId, User $by, string $device, ClientKind $client): Guest
    {
        return $this->followed($event, $personId, $by, $device, $client, static fn (Guest $person): bool => $person->undoArrival(), self::ARRIVAL_UNDONE);
    }

    /** A full name and nothing else; refused 409 `guest_already_listed`, naming who is, unless `allowDuplicate`. No plan limit is checked at the door. */
    public function walkIn(Event $event, NewGuest $new, User $by, string $device, ClientKind $client, bool $allowDuplicate): Guest
    {
        $guest = $this->entityManager->wrapInTransaction(function () use ($event, $new, $by, $device, $client, $allowDuplicate): Guest {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $now = $this->open($event);

            if (!$allowDuplicate) {
                $listed = $this->guestRepository->findOneNamed($event, $new->nameKey);

                if (null !== $listed) {
                    throw new ApiException(ErrorCode::GuestAlreadyListed, 'guest.already_listed', parameters: ['{name}' => $listed->getFullName() ?? $new->fullName], members: ['guest' => ['id' => $listed->getId()->toRfc4122(), 'fullName' => $listed->getFullName(), 'hostId' => $listed->getHost()?->getId()->toRfc4122()]]);
                }
            }

            $guest = Guest::walkedIn($event, $new->fullName, $new->nameKey, $by, $now);
            $this->entityManager->persist($guest);
            $this->audit(self::WALKED_IN, $event, $guest, $by, $device, $client, $now);
            $this->entityManager->flush();

            return $guest;
        });

        $this->checkInSignal->send($event);

        return $guest;
    }

    /** @param Closure(Guest, DateTimeImmutable): bool $change */
    private function followed(Event $event, string $personId, User $by, string $device, ClientKind $client, Closure $change, string $action, ?DateTimeImmutable $recordedAt = null): Guest
    {
        $changed = false;
        $person = $this->arrivalFollower->arrival($event, $by, function () use ($event, $personId, $by, $device, $client, $change, $action, $recordedAt, &$changed): Guest {
            [$person, $changed] = $this->stored($event, $personId, $by, $device, $client, $change, $action, $recordedAt);

            return $person;
        });

        if ($changed) {
            $this->checkInSignal->send($event);
        }

        return $person;
    }

    /**
     * @param Closure(Guest, DateTimeImmutable): bool $change
     *
     * @return array{Guest, bool}
     */
    private function stored(Event $event, string $personId, User $by, string $device, ClientKind $client, Closure $change, string $action, ?DateTimeImmutable $recordedAt = null): array
    {
        $changed = false;
        $person = $this->entityManager->wrapInTransaction(function () use ($event, $personId, $by, $device, $client, $change, $action, $recordedAt, &$changed): Guest {
            $person = Uuid::isValid($personId) ? $this->guestRepository->findOneInEvent($event->getId(), Uuid::fromString($personId)) : null;

            if (null === $person) {
                throw ApiException::notFound('access.not_found');
            }

            $person = $this->lockedWithHost($person);
            $now = $this->open($event, $recordedAt);
            $changed = $change($person, $now);

            if ($changed) {
                $this->audit($action, $event, $person, $by, $device, $client, $now);
                $this->entityManager->flush();
            }

            return $person;
        });

        return [$person, $changed];
    }

    /** The host first, as a removal or an edit of the party locks it, so an arrival queues behind them and never lands on a companion they took off the list. */
    private function lockedWithHost(Guest $person): Guest
    {
        $host = $person->getHost();

        if (null !== $host) {
            $this->entityManager->refresh($host, LockMode::PESSIMISTIC_WRITE);
        }

        $id = $person->getId()->toRfc4122();

        if (false === $this->entityManager->getConnection()->fetchOne('SELECT 1 FROM guests WHERE id = :id FOR UPDATE', ['id' => $id])) {
            throw ApiException::notFound('access.not_found');
        }

        $this->entityManager->refresh($person);

        if ($person->isRemoved() || true === $host?->isRemoved()) {
            throw ApiException::notFound('access.not_found');
        }

        return $person;
    }

    private function open(Event $event, ?DateTimeImmutable $recordedAt = null): DateTimeImmutable
    {
        $now = DateTimeImmutable::createFromInterface($this->clock->now());
        $when = null === $recordedAt || $recordedAt > $now ? $now : $recordedAt;

        if (CheckInState::Open !== CheckInWindow::stateOf($event, $when)) {
            throw new ApiException(ErrorCode::CheckInClosed, 'check_in.closed');
        }

        return $now;
    }

    private function audit(string $action, Event $event, Guest $person, User $by, string $device, ClientKind $client, DateTimeImmutable $at): void
    {
        $this->auditor->record($action, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), [
            'guest' => [null, $person->getId()->toRfc4122()],
            'device' => [null, $device],
            'client' => [null, $client->value],
        ], $at);
    }
}
