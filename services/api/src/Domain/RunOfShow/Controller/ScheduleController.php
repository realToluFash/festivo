<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Controller;

use App\Domain\RunOfShow\Http\ScheduleSerialiser;
use App\Domain\RunOfShow\ScheduleEditor;
use App\Domain\RunOfShow\ScheduleRules;
use App\Entity\Event;
use App\Entity\ScheduleItem;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Realtime\SubscriberTokenIssuer;
use App\Repository\EventRepository;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** An event's running order, built on the Schedule page (sc-3893). Every answer carries the schedule whole. */
final readonly class ScheduleController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private ScheduleRules $scheduleRules,
        private ScheduleEditor $scheduleEditor,
        private ScheduleSerialiser $scheduleSerialiser,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
    ) {
    }

    #[Route('/api/events/{eventId}/schedule', name: 'schedule_show', methods: ['GET'])]
    #[InEvent(Permission::RunOfShowRead)]
    public function show(string $eventId): JsonResponse
    {
        return $this->schedule($this->event($eventId));
    }

    /** `startsAt` is the wall-clock time in the event's zone. Refused `validation_failed` on each field at once, and 409 `schedule_item_limit` at 200 items. */
    #[Route('/api/events/{eventId}/schedule/items', name: 'schedule_items_add', methods: ['POST'])]
    #[InEvent(Permission::RunOfShowManage)]
    public function add(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $details = $this->scheduleRules->details($event, Input::body($request, self::shape()));
        $item = $this->scheduleEditor->add($event, $details, $this->user());

        return $this->schedule($event, Response::HTTP_CREATED, $item);
    }

    /** The whole item; needs If-Match with its `version` as an ETag, `"3"`. A colleague's change since is 412, with the item as it now stands in `current` and who changed it in `changedBy`. */
    #[Route('/api/events/{eventId}/schedule/items/{itemId}', name: 'schedule_items_change', methods: ['PUT'])]
    #[InEvent(Permission::RunOfShowManage)]
    public function change(Request $request, string $eventId, #[InThisEvent('itemId')] ScheduleItem $item): JsonResponse
    {
        $event = $this->event($eventId);
        $details = $this->scheduleRules->details($event, Input::body($request, self::shape()));
        $this->scheduleEditor->change($event, $item, $request->headers->get('If-Match'), $details, $this->user());

        return $this->schedule($event, Response::HTTP_OK, $item);
    }

    /** Marks it started now, by the server's clock; its planned start does not move (sc-1404). */
    #[Route('/api/events/{eventId}/schedule/items/{itemId}/start', name: 'schedule_items_start', methods: ['POST'])]
    #[InEvent(Permission::RunOfShowManage)]
    public function start(string $eventId, #[InThisEvent('itemId')] ScheduleItem $item): JsonResponse
    {
        $event = $this->event($eventId);
        $this->scheduleEditor->start($event, $item, $this->user());

        return $this->schedule($event, Response::HTTP_OK, $item);
    }

    #[Route('/api/events/{eventId}/schedule/items/{itemId}/finish', name: 'schedule_items_finish', methods: ['POST'])]
    #[InEvent(Permission::RunOfShowManage)]
    public function finish(string $eventId, #[InThisEvent('itemId')] ScheduleItem $item): JsonResponse
    {
        $event = $this->event($eventId);
        $this->scheduleEditor->finish($event, $item, $this->user());

        return $this->schedule($event, Response::HTTP_OK, $item);
    }

    /** Undo on the page adds it back. */
    #[Route('/api/events/{eventId}/schedule/items/{itemId}', name: 'schedule_items_delete', methods: ['DELETE'])]
    #[InEvent(Permission::RunOfShowManage)]
    public function delete(string $eventId, #[InThisEvent('itemId')] ScheduleItem $item): JsonResponse
    {
        $event = $this->event($eventId);
        $this->scheduleEditor->delete($event, $item, $this->user());

        return $this->schedule($event);
    }

    /** A hub token for this event's schedule alone; every change publishes the schedule whole there. */
    #[Route('/api/events/{eventId}/schedule/subscriptions', name: 'schedule_subscribe', methods: ['POST'])]
    #[InEvent(Permission::RunOfShowRead)]
    public function subscribe(string $eventId): JsonResponse
    {
        $issued = $this->subscriberTokenIssuer->issueForEventSchedule($this->event($eventId)->getId());

        return new JsonResponse([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->format(\DATE_ATOM),
        ]);
    }

    /** @return Type\TypeInterface<array{title: string, startsAt: ?string, lengthMinutes?: ?int, place?: ?string, ownerName?: ?string, ownerRole?: ?string, note?: ?string, fixedTime?: bool, showToGuests?: bool}> */
    private static function shape(): Type\TypeInterface
    {
        return Type\shape([
            'title' => Type\string(),
            'startsAt' => Type\nullable(Type\string()),
            'lengthMinutes' => Type\optional(Type\nullable(Type\int())),
            'place' => Type\optional(Type\nullable(Type\string())),
            'ownerName' => Type\optional(Type\nullable(Type\string())),
            'ownerRole' => Type\optional(Type\nullable(Type\string())),
            'note' => Type\optional(Type\nullable(Type\string())),
            'fixedTime' => Type\optional(Type\bool()),
            'showToGuests' => Type\optional(Type\bool()),
        ]);
    }

    private function schedule(Event $event, int $status = Response::HTTP_OK, ?ScheduleItem $item = null): JsonResponse
    {
        return new JsonResponse(
            ['schedule' => $this->scheduleSerialiser->schedule($event)] + (null === $item ? [] : ['itemId' => $item->getId()->toRfc4122()]),
            $status,
        );
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
