<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Audit\Auditor;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\SeatingNote;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\RealtimeTopic;
use App\Enum\SeatingNoteKind;
use App\Http\Exception\ApiException;
use App\Realtime\RealtimePublisher;
use App\Repository\SeatingNoteRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** What the host knows about two guests (sc-1364): kept, shown and told only to people who manage the seating, never moving anyone. */
final readonly class SeatingNotes
{
    public const string ADDED = 'seating.note_added';

    public const string REMOVED = 'seating.note_removed';

    public function __construct(
        private SeatingNoteRepository $seatingNoteRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private RealtimePublisher $realtimePublisher,
    ) {
    }

    /** @return list<SeatingNote> those whose two guests are both still on the list */
    public function on(Event $event): array
    {
        return Vec\filter(
            $this->seatingNoteRepository->findOnEvent($event),
            static fn (SeatingNote $note): bool => null === $note->getGuest()->getRemovedAt() && null === $note->getOtherGuest()->getRemovedAt(),
        );
    }

    /**
     * A named guest or companion of this event, never themselves: 422 otherwise. The pair's note again is 409 `seating_note_same`, and the other kind is 409 `seating_note_replaces` unless `$replace`.
     */
    public function add(Event $event, User $by, Guest $one, Guest $other, SeatingNoteKind $kind, bool $replace): SeatingNote
    {
        foreach ([$one, $other] as $guest) {
            if (!self::mayHaveANote($event, $guest)) {
                throw new ApiException(ErrorCode::SeatingNoteInvalid, 'seating.note_invalid');
            }
        }

        if ($one->getId()->equals($other->getId())) {
            throw new ApiException(ErrorCode::SeatingNoteInvalid, 'seating.note_invalid');
        }

        $held = $this->seatingNoteRepository->findOneJoining($event, $one->getId(), $other->getId());

        if (null !== $held) {
            if ($held->getKind() === $kind) {
                throw new ApiException(ErrorCode::SeatingNoteSame, 'seating.note_same');
            }

            if (!$replace) {
                throw new ApiException(ErrorCode::SeatingNoteReplaces, 'seating.note_replaces');
            }

            $held->replaceKind($kind);
            $note = $held;
        } else {
            $note = new SeatingNote($event, $one, $other, $kind);
            $this->entityManager->persist($note);
        }

        $this->auditor->record(self::ADDED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName());
        $this->entityManager->flush();
        $this->told($event);

        return $note;
    }

    /** Gone from both guests at once. */
    public function remove(Event $event, User $by, SeatingNote $note): void
    {
        $this->entityManager->remove($note);
        $this->auditor->record(self::REMOVED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName());
        $this->entityManager->flush();
        $this->told($event);
    }

    public function find(Event $event, string $id): ?SeatingNote
    {
        return Uuid::isValid($id) ? $this->seatingNoteRepository->findOneInEvent($event, Uuid::fromString($id)) : null;
    }

    private function told(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventSeatingNotes, $event->getId()->toRfc4122(), ['notes' => 'changed']);
    }

    private static function mayHaveANote(Event $event, Guest $guest): bool
    {
        return $guest->getEvent()->getId()->equals($event->getId()) && null === $guest->getRemovedAt() && null !== $guest->getFullName() && '' !== $guest->getFullName();
    }
}
