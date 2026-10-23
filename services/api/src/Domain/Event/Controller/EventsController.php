<?php

declare(strict_types=1);

namespace App\Domain\Event\Controller;

use App\Domain\Event\EventCreator;
use App\Domain\Event\Http\EventSerialiser;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\OrganisationRepository;
use Psl\Type;
use Psl\Vec;
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
    ) {
    }

    #[Route('/api/orgs/{organisationId}/events', name: 'events_list', methods: ['GET'])]
    #[InOrganisation(Permission::EventsRead)]
    public function list(string $organisationId): JsonResponse
    {
        return new JsonResponse([
            'events' => Vec\map($this->eventRepository->findInOrganisation($this->organisation($organisationId)), EventSerialiser::event(...)),
        ]);
    }

    /** Start and end are local to `timeZone` (sc-1486); a zone or currency left out is the organisation's. */
    #[Route('/api/orgs/{organisationId}/events', name: 'events_create', methods: ['POST'])]
    #[InOrganisation(Permission::EventsCreate)]
    public function create(Request $request, string $organisationId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'name' => Type\optional(Type\nullable(Type\string())),
            'startsAt' => Type\optional(Type\nullable(Type\string())),
            'endsAt' => Type\optional(Type\nullable(Type\string())),
            'timeZone' => Type\optional(Type\nullable(Type\string())),
            'currency' => Type\optional(Type\nullable(Type\string())),
        ]));

        $event = $this->eventCreator->create($this->organisation($organisationId), $this->user(), [
            'name' => $body['name'] ?? null,
            'startsAt' => $body['startsAt'] ?? null,
            'endsAt' => $body['endsAt'] ?? null,
            'timeZone' => $body['timeZone'] ?? null,
            'currency' => $body['currency'] ?? null,
        ]);

        return new JsonResponse(['event' => EventSerialiser::event($event)], Response::HTTP_CREATED);
    }

    #[Route('/api/events/{eventId}', name: 'events_show', methods: ['GET'])]
    #[InEvent(Permission::EventsRead)]
    public function show(string $eventId): JsonResponse
    {
        $event = $this->eventRepository->find($eventId) ?? throw ApiException::notFound('Not found.');

        return new JsonResponse(['event' => EventSerialiser::event($event)]);
    }

    private function organisation(string $id): Organisation
    {
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('Not found.');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'Please sign in to continue.');
    }
}
