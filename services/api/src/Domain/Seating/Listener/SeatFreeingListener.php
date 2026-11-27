<?php

declare(strict_types=1);

namespace App\Domain\Seating\Listener;

use App\Domain\Seating\GuestPageSignal;
use App\Domain\Seating\Http\SeatingSerialiser;
use App\Domain\Seating\Numbers\SeatingNumbersPublisher;
use App\Entity\Event;
use App\Entity\Guest;
use App\Enum\GuestReply;
use App\Enum\RealtimeTopic;
use App\Realtime\CheckInSignal;
use App\Realtime\RealtimePublisher;
use App\Repository\GuestRepository;
use App\Repository\SeatAssignmentRepository;
use App\Repository\SeatingPlanRepository;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\OnFlushEventArgs;
use Doctrine\ORM\Event\PostFlushEventArgs;
use Doctrine\ORM\Events;

/** Not coming, off the list, or a companion unticked or removed: the chair empties, a lead's companions' too, on every open plan, with no message or Undo (sc-4013). */
#[AsDoctrineListener(event: Events::onFlush)]
#[AsDoctrineListener(event: Events::postFlush)]
final class SeatFreeingListener
{
    /** @var array<string, Event> */
    private array $freedIn = [];

    public function __construct(
        private readonly SeatAssignmentRepository $seatAssignmentRepository,
        private readonly GuestRepository $guestRepository,
        private readonly SeatingPlanRepository $seatingPlanRepository,
        private readonly SeatingSerialiser $seatingSerialiser,
        private SeatingNumbersPublisher $seatingNumbersPublisher,
        private readonly RealtimePublisher $realtimePublisher,
        private readonly GuestPageSignal $guestPageSignal,
        private readonly CheckInSignal $checkInSignal,
    ) {
    }

    public function onFlush(OnFlushEventArgs $args): void
    {
        $entityManager = $args->getObjectManager();
        $unitOfWork = $entityManager->getUnitOfWork();
        $leaving = [];

        foreach ($unitOfWork->getScheduledEntityUpdates() as $entity) {
            if ($entity instanceof Guest && self::leaves($unitOfWork->getEntityChangeSet($entity))) {
                $leaving = [...$leaving, $entity, ...(null === $entity->getHost() ? $this->guestRepository->findCompanionsOf($entity) : [])];
            }
        }

        foreach ($unitOfWork->getScheduledEntityDeletions() as $entity) {
            if ($entity instanceof Guest) {
                $leaving[] = $entity;
            }
        }

        if ([] === $leaving) {
            return;
        }

        foreach ($this->seatAssignmentRepository->findOfGuests($leaving) as $assignment) {
            if (!$unitOfWork->isScheduledForDelete($assignment)) {
                $event = $assignment->getGuest()->getEvent();
                $this->freedIn[$event->getId()->toRfc4122()] = $event;
                $entityManager->remove($assignment);
            }
        }
    }

    public function postFlush(PostFlushEventArgs $args): void
    {
        $events = $this->freedIn;
        $this->freedIn = [];

        foreach ($events as $id => $event) {
            $this->checkInSignal->send($event);
            $this->seatingNumbersPublisher->publish($event);
            $this->realtimePublisher->publish(RealtimeTopic::EventSeating, $id, $this->seatingSerialiser->seating($event, $this->seatingPlanRepository->findOneForEvent($event)));
            $this->guestPageSignal->seatingChanged($event);
        }
    }

    /** @param array<string, mixed> $changes */
    private static function leaves(array $changes): bool
    {
        $after = static fn (string $field): mixed => \is_array($changes[$field] ?? null) ? $changes[$field][1] ?? null : null;

        $reply = $after('reply');

        return GuestReply::NotComing === $reply || GuestReply::NotComing->value === $reply || null !== $after('removedAt') || true === $after('notComingByGuest');
    }
}
