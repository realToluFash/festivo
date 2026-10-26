<?php

declare(strict_types=1);

namespace App\Domain\Event\Controller;

use App\Domain\Event\EventCreator;
use App\Domain\Event\EventEditor;
use App\Domain\Event\EventLifecycle;
use App\Domain\Event\Http\EventSerialiser;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Access\Policy\InOrganisation;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\OrganisationRepository;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final readonly class EventsController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private EventRepository $eventRepository,
        private EventCreator $eventCreator,
        private EventEditor $eventEditor,
        private EventSerialiser $eventSerialiser,
        private EventLifecycle $eventLifecycle,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/events', name: 'events_list', methods: ['GET'])]
    #[InOrganisation(Permission::EventsRead)]
    public function list(string $organisationId): JsonResponse
    {
        return new JsonResponse([
            'events' => $this->eventSerialiser->events($this->eventRepository->findInOrganisation($this->organisation($organisationId))),
        ]);
    }

    /** Start and end are local to `timeZone` (sc-1486); a zone or currency left out is the organisation's. */
    #[Route('/api/orgs/{organisationId}/events', name: 'events_create', methods: ['POST'])]
    #[InOrganisation(Permission::EventsCreate)]
    public function create(Request $request, string $organisationId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'name' => Type\optional(Type\nullable(Type\string())),
            'type' => Type\optional(Type\nullable(Type\string())),
            'startsAt' => Type\optional(Type\nullable(Type\string())),
            'endsAt' => Type\optional(Type\nullable(Type\string())),
            'timeZone' => Type\optional(Type\nullable(Type\string())),
            'currency' => Type\optional(Type\nullable(Type\string())),
            'venue' => Type\optional(self::venue()),
        ]));

        $event = $this->eventCreator->create($this->organisation($organisationId), $this->user(), [
            'name' => $body['name'] ?? null,
            'type' => $body['type'] ?? null,
            'startsAt' => $body['startsAt'] ?? null,
            'endsAt' => $body['endsAt'] ?? null,
            'timeZone' => $body['timeZone'] ?? null,
            'currency' => $body['currency'] ?? null,
            'venue' => $body['venue'] ?? null,
        ]);

        return new JsonResponse(['event' => $this->eventSerialiser->event($event)], Response::HTTP_CREATED);
    }

    #[Route('/api/events/{eventId}', name: 'events_show', methods: ['GET'])]
    #[InEvent(Permission::EventsRead)]
    public function show(string $eventId): JsonResponse
    {
        return $this->tagged($this->event($eventId));
    }

    /** Any of the seven fields; those left out keep their value, and a `venue` of null removes it. Needs If-Match with the ETag it read (sc-3587). */
    #[Route('/api/events/{eventId}', name: 'events_update', methods: ['PATCH'])]
    #[InEvent(Permission::EventsManage)]
    public function update(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'name' => Type\optional(Type\string()),
            'type' => Type\optional(Type\nullable(Type\string())),
            'startsAt' => Type\optional(Type\string()),
            'endsAt' => Type\optional(Type\string()),
            'timeZone' => Type\optional(Type\string()),
            'currency' => Type\optional(Type\string()),
            'venue' => Type\optional(self::venue()),
        ]));

        return $this->tagged($this->eventEditor->edit($event, $request->headers->get('If-Match'), $this->user(), $body));
    }

    /** Refused 409 `event_state_invalid` unless it is a Draft, 409 `event_concluded` once its end has passed, and 403 `plan_limit` (sc-3584). */
    #[Route('/api/events/{eventId}/make-live', name: 'events_make_live', methods: ['POST'])]
    #[InEvent(Permission::EventsManage)]
    public function makeLive(string $eventId): JsonResponse
    {
        return $this->tagged($this->eventLifecycle->makeLive($this->event($eventId), $this->user()));
    }

    /** Calls the event off before its start and ends it early after: refused 409 `event_state_invalid` unless Live or Paused, and 409 `event_concluded` once its end has passed (sc-3585). */
    #[Route('/api/events/{eventId}/end', name: 'events_end', methods: ['POST'])]
    #[InEvent(Permission::EventsManage)]
    public function end(string $eventId): JsonResponse
    {
        return $this->tagged($this->eventLifecycle->end($this->event($eventId), $this->user()));
    }

    /**
     * `addressId` is the suggestion the address was picked from (sc-53); without it the address is kept as typed.
     *
     * @return Type\TypeInterface<array{name?: ?string, address?: ?string, addressId?: ?string}|null>
     */
    private static function venue(): Type\TypeInterface
    {
        return Type\nullable(Type\shape([
            'name' => Type\optional(Type\nullable(Type\string())),
            'address' => Type\optional(Type\nullable(Type\string())),
            'addressId' => Type\optional(Type\nullable(Type\string())),
        ]));
    }

    private function tagged(Event $event): JsonResponse
    {
        return new JsonResponse(['event' => $this->eventSerialiser->event($event)], Response::HTTP_OK, ['ETag' => EntityTag::of($event->getVersion())]);
    }

    private function event(string $id): Event
    {
        return $this->eventRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function organisation(string $id): Organisation
    {
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
