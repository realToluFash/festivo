<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Controller;

use App\Domain\Messaging\EventMuter;
use App\Domain\Messaging\Http\NotificationItemSerialiser;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventMuteRepository;
use App\Repository\EventRepository;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** Mute this event (sc-3980), the caller's own: the card on the event's page and the bell's More are this one switch. */
final readonly class EventMuteController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private EventMuteRepository $eventMuteRepository,
        private EventMuter $eventMuter,
    ) {
    }

    #[Route('/api/events/{eventId}/mute', name: 'events_mute', methods: ['GET'])]
    #[InEvent(Permission::EventsRead)]
    public function show(string $eventId): JsonResponse
    {
        return $this->answer(null !== $this->eventMuteRepository->findOneFor($this->user(), $this->event($eventId)));
    }

    #[Route('/api/events/{eventId}/mute', name: 'events_mute_set', methods: ['PUT'])]
    #[InEvent(Permission::EventsRead)]
    public function set(Request $request, string $eventId): JsonResponse
    {
        $muted = Input::body($request, Type\shape(['muted' => Type\bool()]))['muted'];
        $this->eventMuter->set($this->user(), $this->event($eventId), $muted);

        return $this->answer($muted);
    }

    private function answer(bool $muted): JsonResponse
    {
        return new JsonResponse(['muted' => $muted, 'markedWhenMuted' => NotificationItemSerialiser::markedWhenMuted()]);
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
