<?php

declare(strict_types=1);

namespace App\Domain\Seating\Controller;

use App\Domain\Seating\Http\SeatingSerialiser;
use App\Domain\Seating\SeatingPlanEditor;
use App\Entity\Event;
use App\Entity\SeatingPlan;
use App\Entity\SeatingSection;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\SectionColour;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Realtime\SubscriberTokenIssuer;
use App\Repository\EventRepository;
use App\Repository\SeatingPlanRepository;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** An event's seating plan: its room and its sections (sc-3998). The room's ETag is the plan's; each section carries its own `version`. */
final readonly class SeatingPlanController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private SeatingPlanRepository $seatingPlanRepository,
        private SeatingPlanEditor $seatingPlanEditor,
        private SeatingSerialiser $seatingSerialiser,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
    ) {
    }

    /** `plan` is null when the event has none yet; `measurementSystem` is the organisation's, from its country. */
    #[Route('/api/events/{eventId}/seating-plan', name: 'seating_plan_show', methods: ['GET'])]
    #[InEvent(Permission::SeatingRead)]
    public function show(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);

        return $this->seating($event, $this->seatingPlanRepository->findOneForEvent($event));
    }

    /** Refused 409 `seating_plan_exists` when the event already has one. */
    #[Route('/api/events/{eventId}/seating-plan', name: 'seating_plan_start', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function start(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'roomName' => Type\optional(Type\nullable(Type\string())),
            'widthCm' => Type\optional(Type\nullable(Type\int())),
            'lengthCm' => Type\optional(Type\nullable(Type\int())),
        ]));

        $plan = $this->seatingPlanEditor->start($event, $this->user(), $body['roomName'] ?? null, $body['widthCm'] ?? null, $body['lengthCm'] ?? null);

        return $this->seating($event, $plan, Response::HTTP_CREATED);
    }

    /** Any of the three; needs If-Match with the ETag it read, and a colleague's change since is 412 naming them in `changedBy`. */
    #[Route('/api/events/{eventId}/seating-plan', name: 'seating_plan_change', methods: ['PATCH'])]
    #[InEvent(Permission::SeatingManage)]
    public function change(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'roomName' => Type\optional(Type\nullable(Type\string())),
            'widthCm' => Type\optional(Type\int()),
            'lengthCm' => Type\optional(Type\int()),
        ]));

        $plan = $this->seatingPlanEditor->change($event, $this->plan($event), $request->headers->get('If-Match'), $this->user(), $body);

        return $this->seating($event, $plan);
    }

    #[Route('/api/events/{eventId}/seating-plan', name: 'seating_plan_delete', methods: ['DELETE'])]
    #[InEvent(Permission::SeatingManage)]
    public function delete(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $this->seatingPlanEditor->delete($event, $this->plan($event), $this->user());

        return $this->seating($event, null);
    }

    /** With no `colour`, the least used. Refused 409 `seating_section_limit` past 30. */
    #[Route('/api/events/{eventId}/seating-plan/sections', name: 'seating_sections_add', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function addSection(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'name' => Type\string(),
            'colour' => Type\optional(Type\nullable(Type\backed_enum(SectionColour::class))),
        ]));

        $this->seatingPlanEditor->addSection($event, $this->plan($event), $this->user(), $body['name'], $body['colour'] ?? null);

        return $this->seating($event, $this->plan($event), Response::HTTP_CREATED);
    }

    /** Needs If-Match with the section's `version` as an ETag, `"3"`. */
    #[Route('/api/events/{eventId}/seating-plan/sections/{sectionId}', name: 'seating_sections_change', methods: ['PATCH'])]
    #[InEvent(Permission::SeatingManage)]
    public function changeSection(Request $request, string $eventId, #[InThisEvent('sectionId')] SeatingSection $section): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'name' => Type\optional(Type\string()),
            'colour' => Type\optional(Type\backed_enum(SectionColour::class)),
        ]));

        $this->seatingPlanEditor->changeSection($event, $section, $request->headers->get('If-Match'), $this->user(), $body);

        return $this->seating($event, $section->getPlan());
    }

    #[Route('/api/events/{eventId}/seating-plan/sections/{sectionId}', name: 'seating_sections_delete', methods: ['DELETE'])]
    #[InEvent(Permission::SeatingManage)]
    public function deleteSection(string $eventId, #[InThisEvent('sectionId')] SeatingSection $section): JsonResponse
    {
        $event = $this->event($eventId);
        $plan = $section->getPlan();
        $this->seatingPlanEditor->deleteSection($event, $section, $this->user());

        return $this->seating($event, $plan);
    }

    /** A hub token for this event's seating alone; every change to the plan is published there whole. */
    #[Route('/api/events/{eventId}/seating-plan/subscriptions', name: 'seating_plan_subscribe', methods: ['POST'])]
    #[InEvent(Permission::SeatingRead)]
    public function subscribe(string $eventId): JsonResponse
    {
        $issued = $this->subscriberTokenIssuer->issueForEventSeating($this->event($eventId)->getId());

        return new JsonResponse([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->format(\DATE_ATOM),
        ]);
    }

    private function seating(Event $event, ?SeatingPlan $plan, int $status = Response::HTTP_OK): JsonResponse
    {
        return new JsonResponse(
            ['seating' => $this->seatingSerialiser->seating($event, $plan)],
            $status,
            null === $plan ? [] : ['ETag' => EntityTag::of($plan->getVersion())],
        );
    }

    private function plan(Event $event): SeatingPlan
    {
        return $this->seatingPlanRepository->findOneForEvent($event) ?? throw ApiException::notFound('seating.no_plan');
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
