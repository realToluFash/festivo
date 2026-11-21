<?php

declare(strict_types=1);

namespace App\Domain\Event\Deletion;

use App\Audit\Auditor;
use App\Deletion\RestoreWindow;
use App\Deletion\TypedName;
use App\Domain\Messaging\EventChanges\EventChangeRecorder;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventStatus;
use App\Http\Exception\ApiException;
use App\Repository\GuestRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Deletes an event for everybody (sc-3592). Only the event's row is marked, so a restore brings back what lay beneath it as it was. */
final readonly class EventDeleter
{
    public const string DELETED = 'event.deleted';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
        private EventChangeRecorder $eventChangeRecorder,
        private GuestRepository $guestRepository,
        private DeleteRefusal $deleteRefusal,
    ) {
    }

    /** A Draft with nobody on its list loses nothing anybody else has seen, so only it skips the name typed (sc-1468). */
    public function needsName(Event $event): bool
    {
        return EventStatus::Draft !== $event->getStatus() || $this->people($event) > 0;
    }

    /** What its list loses: the Guests header's N, guests and companions together. */
    public function people(Event $event): int
    {
        return $this->guestRepository->countPeople($event);
    }

    public function refusedBecause(Event $event): ?string
    {
        return $this->deleteRefusal->of($event);
    }

    /** Refused 409 `event_call_off_first` while a guest is invited and it is not Finished, before the name typed is read (sc-14445). */
    public function delete(Event $event, User $by, ?string $typedName): DateTimeImmutable
    {
        if (null !== $this->refusedBecause($event)) {
            throw new ApiException(ErrorCode::EventCallOffFirst, $this->translator->trans('event.call_off_first'));
        }

        if ($this->needsName($event) && !TypedName::matches($typedName ?? '', $event->getName())) {
            throw ApiException::validation([[
                'propertyPath' => 'name',
                'message' => $this->translator->trans('event.delete_name_mismatch', ['{name}' => $event->getName()]),
                'code' => 'event_name_mismatch',
            ]]);
        }

        return $this->entityManager->wrapInTransaction(function () use ($event, $by): DateTimeImmutable {
            $at = RestoreWindow::toTheSecond($this->clock->now());
            $event->setDeletedAt($at);
            $event->setDeletedBy($by->getId());
            $this->auditor->record(self::DELETED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), [
                'name' => [$event->getName(), null],
                'deletedAt' => [null, $at->format(\DATE_ATOM)],
            ]);
            $this->eventChangeRecorder->deleted($event, $by, RestoreWindow::closesAt($at));
            $this->entityManager->flush();

            return $at;
        });
    }
}
