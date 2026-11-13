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
use App\Enum\EventType;
use App\Enum\Permission;
use App\Http\Access\Grants;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InEvent;
use App\Http\Access\Policy\InOrganisation;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Http\Exception\ShapeRefusal;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\EventSearch;
use App\Repository\OrganisationRepository;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Math;
use Psl\Str;
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

    /** A page of the unfinished, or with `finished=true` the Finished, each with its timeline's milestones (sc-3594). A Member's has only the events they have a role on (sc-29912). */
    #[Route('/api/orgs/{organisationId}/events', name: 'events_list', methods: ['GET'])]
    #[InOrganisation(null)]
    public function list(Request $request, string $organisationId): JsonResponse
    {
        $query = Input::query($request, Type\shape([
            'finished' => Type\optional(Type\union(Type\literal_scalar('true'), Type\literal_scalar('false'))),
            'page' => Type\optional(Type\positive_int()),
            'itemsPerPage' => Type\optional(Type\positive_int()),
            'q' => Type\optional(Type\string()),
            'type' => Type\optional(Type\string()),
            'from' => Type\optional(Type\string()),
            'to' => Type\optional(Type\string()),
            'host' => Type\optional(Type\union(Type\string(), Type\vec(Type\string()))),
        ]));
        $search = self::search($query);
        $organisation = $this->organisation($organisationId);
        $scope = $this->membershipDirectory->eventScopeIn($this->user(), $organisation->getId()) ?? throw ApiException::notFound('access.not_found');
        $finished = 'true' === ($query['finished'] ?? 'false');
        $page = $query['page'] ?? 1;
        $perPage = Math\minva($query['itemsPerPage'] ?? self::PER_PAGE, self::MOST_PER_PAGE);
        $now = $this->clock->now();
        $events = $this->eventRepository->findPageInOrganisation($organisation, $finished, $now, $page, $perPage, $scope->onlyFor, $search);

        return new JsonResponse([
            'events' => Vec\map(Vec\zip($events, $this->eventSerialiser->events($events, $scope)), fn (array $pair): array => [...$pair[1], 'milestones' => $this->milestoneSerialiser->milestones($pair[0], $scope->on($pair[0]->getId()) ?? Grants::only([]))]),
            'total' => $this->eventRepository->countPhaseInOrganisation($organisation, $finished, $now, $scope->onlyFor, $search),
            'page' => $page,
            'itemsPerPage' => $perPage,
        ]);
    }

    /** The names Events' Filter offers under Hosted by: every one on the events the caller sees (sc-30302). */
    #[Route('/api/orgs/{organisationId}/events/hosts', name: 'events_hosts', methods: ['GET'])]
    #[InOrganisation(null)]
    public function hosts(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $scope = $this->membershipDirectory->eventScopeIn($this->user(), $organisation->getId()) ?? throw ApiException::notFound('access.not_found');

        return new JsonResponse(['hosts' => $this->eventRepository->findHostNamesInOrganisation($organisation, $scope->onlyFor)]);
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

        return new JsonResponse(['event' => $this->eventSerialiser->event($event, $this->grantsOn($event))], Response::HTTP_CREATED);
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

    /** A Draft from `startsAt`, local to the original's zone, in any phase (sc-3593). Needs Create events, since it creates one, and guests.manage as well to bring the guest list (sc-3656). */
    #[Route('/api/events/{eventId}/duplicate', name: 'events_duplicate', methods: ['POST'])]
    #[InEvent(Permission::EventsCreate)]
    public function duplicate(Request $request, string $eventId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'startsAt' => Type\optional(Type\nullable(Type\string())),
            'copyGuests' => Type\optional(Type\bool()),
        ]));
        $original = $this->event($eventId);
        $copyGuests = $body['copyGuests'] ?? false;

        if ($copyGuests && !$this->grantsOn($original)->holds(Permission::GuestsManage)) {
            throw new ApiException(ErrorCode::PermissionRequired, 'access.permission_required', [], null, [], ['permission' => Permission::GuestsManage->value], ['{permission}' => Permission::GuestsManage->value]);
        }

        $duplicate = $this->eventDuplicator->duplicate($original, $this->user(), $body['startsAt'] ?? null, $copyGuests);

        return new JsonResponse([
            'event' => $this->eventSerialiser->event($duplicate->copy, $this->grantsOn($duplicate->copy)),
            ...(null === $duplicate->guestsCopied ? [] : ['guestsCopied' => $duplicate->guestsCopied]),
        ], Response::HTTP_CREATED);
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
        return new JsonResponse(['event' => $this->eventSerialiser->event($event, $this->grantsOn($event))], Response::HTTP_OK, ['ETag' => EntityTag::of($event->getVersion())]);
    }

    private function grantsOn(Event $event): Grants
    {
        return $this->membershipDirectory->grantsOnEvent($this->user(), $event->getOrganisation()->getId(), $event->getId()) ?? Grants::only([]);
    }

    private function event(string $id): Event
    {
        return $this->eventRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    /** @param array{q?: string, type?: string, from?: string, to?: string, host?: string|list<string>, ...} $query */
    private static function search(array $query): EventSearch
    {
        $term = Str\trim($query['q'] ?? '');
        $types = '' === ($query['type'] ?? '') ? [] : Vec\map(
            Str\split($query['type'], ','),
            static fn (string $type): EventType => EventType::tryFrom(Str\trim($type)) ?? throw new ShapeRefusal('type'),
        );
        $hosts = $query['host'] ?? [];

        return new EventSearch(
            term: Str\length($term) < EventSearch::SHORTEST_TERM ? null : $term,
            types: $types,
            from: self::day($query['from'] ?? null, 'from'),
            to: self::day($query['to'] ?? null, 'to'),
            hosts: Vec\filter(\is_string($hosts) ? [$hosts] : $hosts, static fn (string $host): bool => '' !== $host),
        );
    }

    private static function day(?string $written, string $key): ?DateTimeImmutable
    {
        if (null === $written || '' === $written) {
            return null;
        }

        $day = DateTimeImmutable::createFromFormat('!Y-m-d', $written, new DateTimeZone('UTC'));

        return false === $day || $day->format('Y-m-d') !== $written ? throw new ShapeRefusal($key) : $day;
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
