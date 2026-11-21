<?php

declare(strict_types=1);

namespace App\Domain\Guest\Arrival;

use App\Audit\Auditor;
use App\Domain\Guest\GuestListPublisher;
use App\Domain\Guest\Model\NewGuest;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\CheckInState;
use App\Enum\ErrorCode;
use App\Enum\RealtimeTopic;
use App\Http\Exception\ApiException;
use App\Realtime\RealtimePublisher;
use App\Repository\GuestRepository;
use Closure;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** The check-in topic carries only that the list changed, never a name, reply or count, so an ended grant learns nothing from it (sc-28230, Decided 2 Nov). */
final readonly class Arrivals
{
    public const string ARRIVED = 'guest.arrived';

    public const string ARRIVAL_UNDONE = 'guest.arrival_undone';

    public const string WALKED_IN = 'guest.walked_in';

    public function __construct(
        private GuestRepository $guestRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private GuestListPublisher $guestListPublisher,
        private RealtimePublisher $realtimePublisher,
        private ClockInterface $clock,
    ) {
    }

    /** A guest or companion, each on their own; one already arrived keeps their first arrival and nothing is refused. */
    public function arrive(Event $event, string $personId, User $by, string $device): Guest
    {
        return $this->changed($event, $personId, $by, $device, static fn (Guest $person, DateTimeImmutable $at): bool => $person->arrive($at, $by), self::ARRIVED);
    }

    /** Asks nothing first; one not arrived is left as they are. */
    public function undo(Event $event, string $personId, User $by, string $device): Guest
    {
        return $this->changed($event, $personId, $by, $device, static fn (Guest $person): bool => $person->undoArrival(), self::ARRIVAL_UNDONE);
    }

    /** A full name and nothing else; refused 409 `guest_already_listed`, naming who is, unless `allowDuplicate`. No plan limit is checked at the door. */
    public function walkIn(Event $event, NewGuest $new, User $by, string $device, bool $allowDuplicate): Guest
    {
        $guest = $this->entityManager->wrapInTransaction(function () use ($event, $new, $by, $device, $allowDuplicate): Guest {
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
            $this->audit(self::WALKED_IN, $event, $guest, $by, $device, $now);
            $this->entityManager->flush();

            return $guest;
        });

        $this->published($event);

        return $guest;
    }

    /** @param Closure(Guest, DateTimeImmutable): bool $change */
    private function changed(Event $event, string $personId, User $by, string $device, Closure $change, string $action): Guest
    {
        $changed = false;
        $person = $this->entityManager->wrapInTransaction(function () use ($event, $personId, $by, $device, $change, $action, &$changed): Guest {
            $person = Uuid::isValid($personId) ? $this->guestRepository->findOneInEvent($event->getId(), Uuid::fromString($personId)) : null;

            if (null === $person) {
                throw ApiException::notFound('access.not_found');
            }

            $this->entityManager->refresh($person, LockMode::PESSIMISTIC_WRITE);
            $now = $this->open($event);
            $changed = $change($person, $now);

            if ($changed) {
                $this->audit($action, $event, $person, $by, $device, $now);
                $this->entityManager->flush();
            }

            return $person;
        });

        if ($changed) {
            $this->published($event);
        }

        return $person;
    }

    private function open(Event $event): DateTimeImmutable
    {
        $now = DateTimeImmutable::createFromInterface($this->clock->now());

        if (CheckInState::Open !== CheckInWindow::stateOf($event, $now)) {
            throw new ApiException(ErrorCode::CheckInClosed, 'check_in.closed');
        }

        return $now;
    }

    private function audit(string $action, Event $event, Guest $person, User $by, string $device, DateTimeImmutable $at): void
    {
        $this->auditor->record($action, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), [
            'guest' => [null, $person->getId()->toRfc4122()],
            'device' => [null, $device],
        ], $at);
    }

    private function published(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventCheckIn, $event->getId()->toRfc4122(), []);
        $this->guestListPublisher->publish($event);
    }
}
