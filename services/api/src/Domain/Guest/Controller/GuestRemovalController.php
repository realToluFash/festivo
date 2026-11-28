<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Guest\Http\GuestSerialiser;
use App\Domain\Guest\Removal\GuestRemovals;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Repository\EventRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Remove from the list, its undo, and the erasure once the undo has run out (sc-3774). Each answers 404 for a guest not in that state, as for one never on the list. */
final readonly class GuestRemovalController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private GuestRemovals $guestRemovals,
        private GuestSerialiser $guestSerialiser,
    ) {
    }

    /** Off the list and the counts at once, their companions with them; erased by `erasure`, or by the prune if nothing sends it. */
    #[Route('/api/events/{eventId}/guests/{guestId}', name: 'guests_remove', methods: ['DELETE'])]
    #[InEvent(Permission::GuestsManage)]
    public function remove(string $eventId, string $guestId): Response
    {
        $this->guestRemovals->remove($this->event($eventId), $guestId, $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/api/events/{eventId}/guests/{guestId}/removal', name: 'guests_undo_removal', methods: ['DELETE'])]
    #[InEvent(Permission::GuestsManage)]
    public function undo(string $eventId, string $guestId): JsonResponse
    {
        $guest = $this->guestRemovals->undo($this->event($eventId), $guestId);

        return new JsonResponse(['guest' => $this->guestSerialiser->details($guest, contacts: true)], headers: ['ETag' => EntityTag::of($guest->getVersion())]);
    }

    #[Route('/api/events/{eventId}/guests/{guestId}/erasure', name: 'guests_erase', methods: ['POST'])]
    #[InEvent(Permission::GuestsManage)]
    public function erase(string $eventId, string $guestId): Response
    {
        $this->guestRemovals->erase($this->event($eventId), $guestId);

        return new Response(null, Response::HTTP_NO_CONTENT);
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
