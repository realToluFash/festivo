<?php

declare(strict_types=1);

namespace App\Domain\Seating\Controller;

use App\Domain\Seating\SeatingNotes;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\SeatingNote;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\SeatingNoteKind;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\GuestRepository;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** The host's seating notes (sc-1364), for `seating.manage` alone: a role that can only read the seating gets 403, as it gets no notes anywhere else. */
final readonly class SeatingNotesController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private GuestRepository $guestRepository,
        private SeatingNotes $seatingNotes,
    ) {
    }

    #[Route('/api/events/{eventId}/seating-plan/notes', name: 'seating_notes_list', methods: ['GET'])]
    #[InEvent(Permission::SeatingManage)]
    public function list(string $eventId): JsonResponse
    {
        return $this->answer($this->event($eventId));
    }

    /** 422 for a guest who cannot hold one, 409 `seating_note_same` for the note again and `seating_note_replaces` for the other kind unless `replace` is true. */
    #[Route('/api/events/{eventId}/seating-plan/notes', name: 'seating_notes_add', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function add(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'guestId' => Type\string(),
            'otherGuestId' => Type\string(),
            'kind' => Type\union(Type\literal_scalar('together'), Type\literal_scalar('apart')),
            'replace' => Type\optional(Type\bool()),
        ]));

        $this->seatingNotes->add(
            $event,
            $this->user(),
            $this->guest($body['guestId']),
            $this->guest($body['otherGuestId']),
            SeatingNoteKind::from($body['kind']),
            $body['replace'] ?? false,
        );

        return $this->answer($event, Response::HTTP_CREATED);
    }

    #[Route('/api/events/{eventId}/seating-plan/notes/{noteId}', name: 'seating_notes_remove', methods: ['DELETE'])]
    #[InEvent(Permission::SeatingManage)]
    public function remove(string $eventId, string $noteId): JsonResponse
    {
        $event = $this->event($eventId);
        $this->seatingNotes->remove($event, $this->user(), $this->seatingNotes->find($event, $noteId) ?? throw ApiException::notFound('access.not_found'));

        return $this->answer($event);
    }

    private function answer(Event $event, int $status = Response::HTTP_OK): JsonResponse
    {
        return new JsonResponse([
            'notes' => Vec\map($this->seatingNotes->on($event), static fn (SeatingNote $note): array => [
                'id' => $note->getId()->toRfc4122(),
                'kind' => $note->getKind()->value,
                'guestId' => $note->getGuest()->getId()->toRfc4122(),
                'otherGuestId' => $note->getOtherGuest()->getId()->toRfc4122(),
            ]),
        ], $status);
    }

    /** A guest the page no longer knows, or one of another event, cannot take a note: 422 where they are named in the body. */
    private function guest(string $id): Guest
    {
        $guest = Uuid::isValid($id) ? $this->guestRepository->find(Uuid::fromString($id)) : null;

        return $guest ?? throw new ApiException(ErrorCode::SeatingNoteInvalid, 'seating.note_invalid');
    }

    private function event(string $id): Event
    {
        return $this->eventRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
