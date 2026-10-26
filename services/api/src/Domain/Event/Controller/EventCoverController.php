<?php

declare(strict_types=1);

namespace App\Domain\Event\Controller;

use App\Domain\Event\Cover\EventCoverEditor;
use App\Domain\Event\Http\EventSerialiser;
use App\Entity\Event;
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
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** An event's cover photo (sc-3590): the photo goes to a signed upload first, then PUT names it. */
final readonly class EventCoverController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private EventRepository $eventRepository,
        private EventCoverEditor $eventCoverEditor,
        private EventSerialiser $eventSerialiser,
    ) {
    }

    /** In the organisation rather than the event, because a new event's form uploads before the event exists. */
    #[Route('/api/orgs/{organisationId}/event-cover-uploads', name: 'event_cover_uploads_create', methods: ['POST'])]
    #[InOrganisation(Permission::EventsManage)]
    public function signUpload(Request $request, string $organisationId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'contentType' => Type\string(),
            'size' => Type\int(),
            'filename' => Type\string(),
        ]));
        $organisation = $this->organisationRepository->find($organisationId) ?? throw ApiException::notFound('access.not_found');

        return new JsonResponse(
            ['upload' => $this->eventCoverEditor->signUpload($organisation, $body['contentType'], $body['size'], $body['filename'])->toArray()],
            Response::HTTP_CREATED,
        );
    }

    /** `uploadKey` is a new photo; left out, the saved photo keeps its file and takes the position and description. */
    #[Route('/api/events/{eventId}/cover', name: 'event_cover_update', methods: ['PUT'])]
    #[InEvent(Permission::EventsManage)]
    public function update(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'uploadKey' => Type\optional(Type\nullable(Type\string())),
            'position' => Type\int(),
            'description' => Type\optional(Type\nullable(Type\string())),
        ]));

        $this->eventCoverEditor->set($event, $this->user(), $body['uploadKey'] ?? null, $body['position'], $body['description'] ?? null);

        return new JsonResponse(['event' => $this->eventSerialiser->event($event)]);
    }

    #[Route('/api/events/{eventId}/cover', name: 'event_cover_delete', methods: ['DELETE'])]
    #[InEvent(Permission::EventsManage)]
    public function delete(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $this->eventCoverEditor->remove($event, $this->user());

        return new JsonResponse(['event' => $this->eventSerialiser->event($event)]);
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
