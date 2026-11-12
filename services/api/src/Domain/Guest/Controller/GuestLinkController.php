<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Guest\Link\InvitationLinks;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Repository\EventRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** A guest's invitation link, for those who can add guests (sc-1526). Never in the list, which Can view reads. */
final readonly class GuestLinkController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private InvitationLinks $invitationLinks,
    ) {
    }

    /** Refused 409 `event_state_invalid` unless the event's phase allows `invite`. */
    #[Route('/api/events/{eventId}/guests/{guestId}/link', name: 'guests_link', methods: ['GET'])]
    #[InEvent(Permission::GuestsManage)]
    public function link(string $eventId, string $guestId): JsonResponse
    {
        $guest = $this->invitationLinks->guestOn($this->event($eventId), $guestId);

        return new JsonResponse(['url' => $this->invitationLinks->linkOf($guest)], headers: ['Cache-Control' => 'no-store']);
    }

    /** In any phase; the old link answers as an unknown one from now on. */
    #[Route('/api/events/{eventId}/guests/{guestId}/link/replace', name: 'guests_link_replace', methods: ['POST'])]
    #[InEvent(Permission::GuestsManage)]
    public function replace(string $eventId, string $guestId): Response
    {
        $this->invitationLinks->replace($this->invitationLinks->guestOn($this->event($eventId), $guestId), $this->user());

        return new Response(status: Response::HTTP_NO_CONTENT);
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
