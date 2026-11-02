<?php

declare(strict_types=1);

namespace App\Domain\Event\Controller;

use App\Domain\Event\EventCreator;
use App\Domain\Event\EventDuplicator;
use App\Domain\Event\EventEditor;
use App\Domain\Event\EventLifecycle;
use App\Domain\Event\Http\EventSerialiser;
use App\Domain\Event\Http\MilestoneSerialiser;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InEvent;
use App\Http\Access\Policy\InOrganisation;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\OrganisationRepository;
use Psl\Math;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final readonly class EventsController
{
    private const int PER_PAGE = 50;

    private const int MOST_PER_PAGE = 200;

    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private EventRepository $eventRepository,
        private EventCreator $eventCreator,
        private EventEditor $eventEditor,
        private EventSerialiser $eventSerialiser,
        private EventLifecycle $eventLifecycle,
        private MembershipDirectoryInterface $membershipDirectory,
        private MilestoneSerialiser $milestoneSerialiser,
        private ClockInterface $clock,
        private EventDuplicator $eventDuplicator,
    ) {
    }

    /** A page of the unfinished, or with `finished=true` the Finished, each with its timeline's milestones (sc-3594). */
    #[Route('/api/orgs/{organisationId}/events', name: 'events_list', methods: ['GET'])]
    #[InOrganisation(Permission::EventsRead)]
    public function list(Request $request, string $organisationId): JsonResponse
    {
        $query = Input::query($request, Type\shape([
            'finished' => Type\optional(Type\union(Type\literal_scalar('true'), Type\literal_scalar('false'))),
            'page' => Type\optional(Type\positive_int()),
            'itemsPerPage' => Type\optional(Type\positive_int()),
        ]));
        $organisation = $this->organisation($organisationId);
        $grants = $this->membershipDirectory->grantsIn($this->user(), $organisation->getId()) ?? throw ApiException::notFound('access.not_found');
        $finished = 'true' === ($query['finished'] ?? 'false');
        $page = $query['page'] ?? 1;
        $perPage = Math\minva($query['itemsPerPage'] ?? self::PER_PAGE, self::MOST_PER_PAGE);
        $now = $this->clock->now();
        $events = $this->eventRepository->findPageInOrganisation($organisation, $finished, $now, $page, $perPage);

        return new JsonResponse([
            'events' => Vec\map(Vec\zip($events, $this->eventSerialiser->events($events)), fn (array $pair): array => [...$pair[1], 'milestones' => $this->milestoneSerialiser->milestones($pair[0], $grants)]),
            'total' => $this->eventRepository->countPhaseInOrganisation($organisation, $finished, $now),
            'page' => $page,
            'itemsPerPage' => $perPage,
        ]);
    }

    /** Start and end are local to `timeZone` (sc-1486); a zone or currency left out is the organisation's. `hosts` takes the edit's list (sc-22143). */
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
            'hosts' => Type\optional(Type\vec(Type\string())),
        ]));

        $event = $this->eventCreator->create($this->organisation($organisationId), $this->user(), [
            'name' => $body['name'] ?? null,
            'type' => $body['type'] ?? null,
            'startsAt' => $body['startsAt'] ?? null,
            'endsAt' => $body['endsAt'] ?? null,
            'timeZone' => $body['timeZone'] ?? null,
            'currency' => $body['currency'] ?? null,
            'venue' => $body['venue'] ?? null,
            'hosts' => $body['hosts'] ?? [],
        ]);

        return new JsonResponse(['event' => $this->eventSerialiser->event($event)], Response::HTTP_CREATED);
    }

    #[Route('/api/events/{eventId}', name: 'events_show', methods: ['GET'])]
    #[InEvent(Permission::EventsRead)]
    public function show(string $eventId): JsonResponse
    {
        return $this->tagged($this->event($eventId));
    }

    /** Any of the eight fields; those left out keep their value, a `venue` of null removes it, and `hosts` is the whole list (sc-6713). Needs If-Match with the ETag it read (sc-3587). */
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
            'hosts' => Type\optional(Type\vec(Type\string())),
        ]));

        return $this->tagged($this->eventEditor->edit($event, $request->headers->get('If-Match'), $this->user(), $body));
    }

    /** A Draft from `startsAt`, local to the original's zone, in any phase (sc-3593). Needs Create events, since it creates one. */
    #[Route('/api/events/{eventId}/duplicate', name: 'events_duplicate', methods: ['POST'])]
    #[InEvent(Permission::EventsCreate)]
    public function duplicate(Request $request, string $eventId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'startsAt' => Type\optional(Type\nullable(Type\string())),
        ]));

        $copy = $this->eventDuplicator->duplicate($this->event($eventId), $this->user(), $body['startsAt'] ?? null);

        return new JsonResponse(['event' => $this->eventSerialiser->event($copy)], Response::HTTP_CREATED);
    }

    /** Refused 409 `event_state_invalid` unless it is a Draft, 409 `event_concluded` once its end has passed, 409 `event_host_required` with no host (sc-6713), and 403 `plan_limit` (sc-3584). */
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

    /** Refused 409 `event_state_invalid` unless it is Live and not yet Finished (sc-3586). */
    #[Route('/api/events/{eventId}/pause', name: 'events_pause', methods: ['POST'])]
    #[InEvent(Permission::EventsManage)]
    public function pause(string $eventId): JsonResponse
    {
        return $this->tagged($this->eventLifecycle->pause($this->event($eventId), $this->user()));
    }

    /** Refused 409 `event_state_invalid` unless it is Paused and not yet Finished; never by the plan's limit (sc-3586). */
    #[Route('/api/events/{eventId}/resume', name: 'events_resume', methods: ['POST'])]
    #[InEvent(Permission::EventsManage)]
    public function resume(string $eventId): JsonResponse
    {
        return $this->tagged($this->eventLifecycle->resume($this->event($eventId), $this->user()));
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
