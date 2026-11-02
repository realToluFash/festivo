<?php

declare(strict_types=1);

namespace App\Domain\Event\Controller;

use App\Deletion\RestoreWindow;
use App\Domain\Event\Deletion\EventDeleter;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use DateTimeImmutable;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** The event page's Delete event (sc-3592): whether the name must be typed and until when support can undo it, then the deletion. */
final readonly class EventDeletionController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private EventDeleter $eventDeleter,
        private UserMailer $userMailer,
        private ClockInterface $clock,
    ) {
    }

    /** The deadline a deletion sent now would get, written in the caller's zone. */
    #[Route('/api/events/{eventId}/deletion', name: 'events_deletion', methods: ['GET'])]
    #[InEvent(Permission::EventsCreate)]
    public function preview(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);

        return new JsonResponse([
            'needsName' => EventDeleter::needsName($event),
            ...$this->window(RestoreWindow::toTheSecond($this->clock->now())),
        ]);
    }

    /** `name` is the event's name as typed, needed unless it is a Draft, which may send no body: 422 `event_name_mismatch` when it does not match. */
    #[Route('/api/events/{eventId}', name: 'events_delete', methods: ['DELETE'])]
    #[InEvent(Permission::EventsCreate)]
    public function delete(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $typed = '' === Str\trim($request->getContent()) ? null : Input::body($request, Type\shape(['name' => Type\optional(Type\nullable(Type\string()))]))['name'] ?? null;
        $at = $this->eventDeleter->delete($event, $this->user(), $typed);

        return new JsonResponse(['deletedAt' => $at->format(\DATE_ATOM), ...$this->window($at)]);
    }

    /** @return array{restoreClosesAt: string, restoreCloses: string} */
    private function window(DateTimeImmutable $deletedAt): array
    {
        $closes = RestoreWindow::closesAt($deletedAt);
        $user = $this->user();

        return [
            'restoreClosesAt' => $closes->format(\DATE_ATOM),
            'restoreCloses' => $this->userMailer->deadline($closes, $user, $this->userMailer->shownLocaleFor($user)),
        ];
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
