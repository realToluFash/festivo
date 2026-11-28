<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Controller;

use App\Domain\RunOfShow\Http\ScheduleSerialiser;
use App\Domain\RunOfShow\Model\CourseChoice;
use App\Domain\RunOfShow\ScheduleEditor;
use App\Domain\RunOfShow\ScheduleRules;
use App\Entity\Event;
use App\Entity\ScheduleItem;
use App\Entity\SchedulePress;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\PressKind;
use App\Http\Access\Grants;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Realtime\SubscriberTokenIssuer;
use App\Repository\EventRepository;
use App\Repository\MenuCourseRepository;
use DateTimeImmutable;
use Psl\Hash;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** An event's running order, built on the Schedule page (sc-3893). Every answer carries the schedule whole. */
final readonly class ScheduleController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private ScheduleRules $scheduleRules,
        private ScheduleEditor $scheduleEditor,
        private MembershipDirectoryInterface $membershipDirectory,
        private MenuCourseRepository $menuCourseRepository,
        private ScheduleSerialiser $scheduleSerialiser,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
        private ClockInterface $clock,
        private TranslatorInterface $translator,
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
        $body = Input::body($request, self::shape());
        $details = $this->scheduleRules->details($event, $body);
        $item = $this->scheduleEditor->add($event, $details, $this->course($event, $body), $this->user());

        return $this->schedule($event, Response::HTTP_CREATED, $item);
    }

    /** The whole item; needs If-Match with its `version` as an ETag, `"3"`. A colleague's change since is 412, with the item as it now stands in `current` and who changed it in `changedBy`. */
    #[Route('/api/events/{eventId}/schedule/items/{itemId}', name: 'schedule_items_change', methods: ['PUT'])]
    #[InEvent(Permission::RunOfShowManage)]
    public function change(Request $request, string $eventId, #[InThisEvent('itemId')] ScheduleItem $item): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, self::shape());
        $details = $this->scheduleRules->details($event, $body);
        $this->scheduleEditor->change($event, $item, $request->headers->get('If-Match'), $details, $this->course($event, $body), $this->user());

        return $this->schedule($event, Response::HTTP_OK, $item);
    }

    /** Night-screen presses (sc-3895): `pressedAt` is the presser's corrected clock, now when absent; `fromCard` whether it was made on a night opened from a run-of-show card (sc-66580); 409 with `superseded_by` when it changes nothing. */
    #[Route('/api/events/{eventId}/schedule/items/{itemId}/presses', name: 'schedule_items_press', methods: ['POST'])]
    #[InEvent(Permission::RunOfShowManage)]
    public function press(Request $request, string $eventId, #[InThisEvent('itemId')] ScheduleItem $item): JsonResponse
    {
        $event = $this->event($eventId);
        $key = Str\trim($request->headers->get('Idempotency-Key') ?? '');

        if ('' === $key || Str\length($key) > SchedulePress::KEY_MAXIMUM) {
            throw new ApiException(ErrorCode::IdempotencyKeyRequired, 'run_of_show.idempotency_key_required');
        }

        $body = Input::body($request, Type\shape([
            'kind' => Type\backed_enum(PressKind::class),
            'pressedAt' => Type\optional(Type\nullable(Type\string())),
            'fromCard' => Type\optional(Type\bool()),
        ]));
        $sentAt = $body['pressedAt'] ?? null;
        $pressedAt = null === $sentAt ? $this->clock->now() : (DateTimeImmutable::createFromFormat(\DATE_RFC3339_EXTENDED, $sentAt) ?: DateTimeImmutable::createFromFormat(\DATE_ATOM, $sentAt) ?: throw new ApiException(ErrorCode::BadRequest, 'run_of_show.pressed_at_invalid'));
        $fingerprint = Hash\hash($item->getId()->toRfc4122() . "\0" . $body['kind']->value . "\0" . ($sentAt ?? ''), Hash\Algorithm::Sha256);

        $this->scheduleEditor->press($event, $item, $body['kind'], $pressedAt, $key, $fingerprint, $this->user(), $body['fromCard'] ?? false);

        return $this->schedule($event, Response::HTTP_OK, $item);
    }

    /** Ends the notice an item's removed course raised, for everyone who plans the schedule (sc-3898). */
    #[Route('/api/events/{eventId}/schedule/items/{itemId}/course-notice', name: 'schedule_items_course_notice_dismiss', methods: ['DELETE'])]
    #[InEvent(Permission::RunOfShowManage)]
    public function dismissCourseNotice(string $eventId, #[InThisEvent('itemId')] ScheduleItem $item): JsonResponse
    {
        $event = $this->event($eventId);
        $this->scheduleEditor->dismissCourseNotice($event, $item, $this->user());

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

    /** @return Type\TypeInterface<array{title: string, startsAt: ?string, lengthMinutes?: ?int, place?: ?string, ownerName?: ?string, ownerRole?: ?string, note?: ?string, fixedTime?: bool, showToGuests?: bool, courseId?: ?string}> */
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
            'courseId' => Type\optional(Type\nullable(Type\string())),
        ]);
    }

    /**
     * `courseId` left out is no choice, and keeps the link for everyone; sent, it needs menu.read (403) and names a course on this event's menu (sc-3898).
     *
     * @param array{title: string, startsAt: ?string, lengthMinutes?: ?int, place?: ?string, ownerName?: ?string, ownerRole?: ?string, note?: ?string, fixedTime?: bool, showToGuests?: bool, courseId?: ?string} $body
     */
    private function course(Event $event, array $body): ?CourseChoice
    {
        if (!Iter\contains_key($body, 'courseId')) {
            return null;
        }

        $grants = $this->membershipDirectory->grantsOnEvent($this->user(), $event->getOrganisation()->getId(), $event->getId()) ?? Grants::only([]);
        $grants->require(Permission::MenuRead);

        if (null === $body['courseId']) {
            return new CourseChoice(null);
        }

        $course = Uuid::isValid($body['courseId']) ? $this->menuCourseRepository->findOneInEvent($event->getId(), Uuid::fromString($body['courseId'])) : null;

        return new CourseChoice($course ?? throw ApiException::validation([[
            'propertyPath' => 'courseId',
            'message' => $this->translator->trans('validation.schedule_course_unknown'),
            'code' => ErrorCode::ValidationFailed->value,
        ]]));
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
