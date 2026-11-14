<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Guest\Group\GuestGroupMoves;
use App\Domain\Guest\Http\GuestSerialiser;
use App\Domain\Guest\Invitation\GuestInvitations;
use App\Domain\Guest\Model\GroupChoice;
use App\Domain\Guest\Removal\GuestRemovals;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use Psl\Iter;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** One action on many selected guests (sc-3776): Mark as invited (sc-46880), Add to group, and Remove from the list with its one Undo and its erasure. Up to MOST_AT_ONCE guests; each answers what it did to each, so nothing is skipped silently. */
final readonly class GuestsTogetherController
{
    public const int MOST_AT_ONCE = 2000;

    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private GuestGroupMoves $guestGroupMoves,
        private GuestRemovals $guestRemovals,
        private GuestInvitations $guestInvitations,
    ) {
    }

    /** `how` is one of the five ways by hand; refused 409 `event_state_invalid` unless the event's phase allows `invite`. */
    #[Route('/api/events/{eventId}/guests/invitations', name: 'guests_mark_invited_together', methods: ['POST'])]
    #[InEvent(Permission::GuestsManage)]
    public function mark(Request $request, string $eventId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'guestIds' => Type\vec(Type\string()),
            'how' => Type\optional(Type\nullable(Type\string())),
        ]));
        $ids = self::checked($body['guestIds']);
        $marked = $this->guestInvitations->markTogether($this->event($eventId), $ids, $this->guestInvitations->chosen($body['how'] ?? null), $this->user());

        return new JsonResponse([
            'marked' => $marked->marked,
            'already' => $marked->already,
            'gone' => $marked->gone,
        ]);
    }

    /** `group` is one of the event's by `id`, or a `name` to find or make by sc-3775's rules. */
    #[Route('/api/events/{eventId}/guests/group-moves', name: 'guests_move_together', methods: ['POST'])]
    #[InEvent(Permission::GuestsManage)]
    public function move(Request $request, string $eventId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'guestIds' => Type\vec(Type\string()),
            'group' => Type\shape([
                'id' => Type\optional(Type\nullable(Type\string())),
                'name' => Type\optional(Type\nullable(Type\string())),
            ]),
        ]));
        $ids = self::checked($body['guestIds']);
        $id = $body['group']['id'] ?? null;
        $moved = $this->guestGroupMoves->move($this->event($eventId), $ids, new GroupChoice($id, null === $id ? $body['group']['name'] ?? null : null), $this->user());

        return new JsonResponse([
            'group' => GuestSerialiser::group($moved->group),
            'moved' => $moved->moved,
            'already' => $moved->already,
            'gone' => $moved->gone,
        ]);
    }

    #[Route('/api/events/{eventId}/guests/removals', name: 'guests_remove_together', methods: ['POST'])]
    #[InEvent(Permission::GuestsManage)]
    public function remove(Request $request, string $eventId): JsonResponse
    {
        $body = Input::body($request, Type\shape(['guestIds' => Type\vec(Type\string())]));
        $removed = $this->guestRemovals->removeTogether($this->event($eventId), self::checked($body['guestIds']), $this->user());

        return new JsonResponse([
            'removal' => $removed->removalId,
            'guests' => $removed->guests,
            'companions' => $removed->companions,
            'gone' => $removed->gone,
        ]);
    }

    #[Route('/api/events/{eventId}/guests/removals/{removalId}', name: 'guests_undo_together', methods: ['DELETE'])]
    #[InEvent(Permission::GuestsManage)]
    public function undo(string $eventId, string $removalId): JsonResponse
    {
        return new JsonResponse(['guests' => $this->guestRemovals->undoTogether($this->event($eventId), $removalId)]);
    }

    #[Route('/api/events/{eventId}/guests/removals/{removalId}/erasure', name: 'guests_erase_together', methods: ['POST'])]
    #[InEvent(Permission::GuestsManage)]
    public function erase(string $eventId, string $removalId): Response
    {
        $this->guestRemovals->eraseTogether($this->event($eventId), $removalId);

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * @param list<string> $ids
     *
     * @return list<string>
     */
    private static function checked(array $ids): array
    {
        if (Iter\count($ids) > self::MOST_AT_ONCE) {
            throw ApiException::validation([[
                'propertyPath' => 'guestIds',
                'message' => 'validation.guests_too_many',
                'code' => ErrorCode::ValidationFailed->value,
                'parameters' => [],
            ]]);
        }

        return $ids;
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
