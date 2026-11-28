<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Guest\Group\GuestGroupEditor;
use App\Domain\Guest\Http\GuestSerialiser;
use App\Entity\Event;
use App\Entity\GuestGroup;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** An event's groups (sc-3775), made, renamed and deleted with guests.manage. The guest list carries them with their counts for guests.read, and each change publishes it. */
final readonly class GuestGroupsController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private GuestGroupEditor $guestGroupEditor,
    ) {
    }

    /** Refused `validation_failed` on `name`: blank, over 60 characters, a name already used, or 50 groups. */
    #[Route('/api/events/{eventId}/guest-groups', name: 'guest_groups_make', methods: ['POST'])]
    #[InEvent(Permission::GuestsManage)]
    public function make(Request $request, string $eventId): JsonResponse
    {
        $body = Input::body($request, Type\shape(['name' => Type\string()]));
        $group = $this->guestGroupEditor->make($this->event($eventId), $body['name'], $this->user());

        return new JsonResponse(['group' => GuestSerialiser::group($group)], Response::HTTP_CREATED);
    }

    #[Route('/api/events/{eventId}/guest-groups/{groupId}', name: 'guest_groups_rename', methods: ['PUT'])]
    #[InEvent(Permission::GuestsManage)]
    public function rename(Request $request, #[InThisEvent('groupId')] GuestGroup $group): JsonResponse
    {
        $body = Input::body($request, Type\shape(['name' => Type\string()]));

        return new JsonResponse(['group' => GuestSerialiser::group($this->guestGroupEditor->rename($group, $body['name'], $this->user()))]);
    }

    /** Its guests stay on the list with no group. */
    #[Route('/api/events/{eventId}/guest-groups/{groupId}', name: 'guest_groups_delete', methods: ['DELETE'])]
    #[InEvent(Permission::GuestsManage)]
    public function delete(#[InThisEvent('groupId')] GuestGroup $group): Response
    {
        $this->guestGroupEditor->delete($group, $this->user());

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
