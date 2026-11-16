<?php

declare(strict_types=1);

namespace App\Domain\Seating\Controller;

use App\Domain\Seating\Http\SeatingSerialiser;
use App\Domain\Seating\SeatingPlanEditor;
use App\Entity\Event;
use App\Entity\SeatingPlan;
use App\Entity\SeatingRow;
use App\Entity\SeatingSeat;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\SectionColour;
use App\Enum\TableShape;
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

/** An event's seating plan: its room, its sections (sc-3998), its tables (sc-4000), its rows and its single seats (sc-4003). The room's ETag is the plan's; each section, table, row and seat carries its own `version`. */
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

    /** Any of the three; needs If-Match. A size that would leave a table outside is refused 409 `seating_items_outside`, its ids in `outside`. Needs If-Match with the ETag it read, and a colleague's change since is 412 naming them in `changedBy`. */
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

    /** Of `shape`'s default size and seats, named "Table {n}", at the room's centre or the nearest free floor. */
    #[Route('/api/events/{eventId}/seating-plan/tables', name: 'seating_tables_add', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function addTable(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'shape' => Type\backed_enum(TableShape::class),
        ]));

        $table = $this->seatingPlanEditor->addTable($event, $this->plan($event), $this->user(), $body['shape']);

        return $this->seating($event, $table->getPlan(), Response::HTTP_CREATED, ['tableId' => $table->getId()->toRfc4122()]);
    }

    /** Any of the fields; needs If-Match with the table's `version` as an ETag. A round or cocktail table's diameter is `widthCm`. */
    #[Route('/api/events/{eventId}/seating-plan/tables/{tableId}', name: 'seating_tables_change', methods: ['PATCH'])]
    #[InEvent(Permission::SeatingManage)]
    public function changeTable(Request $request, string $eventId, #[InThisEvent('tableId')] SeatingTable $table): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'name' => Type\optional(Type\string()),
            'sectionId' => Type\optional(Type\nullable(Type\string())),
            'shape' => Type\optional(Type\backed_enum(TableShape::class)),
            'seats' => Type\optional(Type\int()),
            'widthCm' => Type\optional(Type\int()),
            'lengthCm' => Type\optional(Type\int()),
            'endSeats' => Type\optional(Type\int()),
            'rotation' => Type\optional(Type\int()),
            'unusableSeats' => Type\optional(Type\vec(Type\int())),
        ]));

        $this->seatingPlanEditor->changeTable($event, $table, $request->headers->get('If-Match'), $this->user(), $body);

        return $this->seating($event, $table->getPlan(), Response::HTTP_OK, ['tableId' => $table->getId()->toRfc4122()]);
    }

    /** The copy, with nobody seated; needs If-Match with the original's `version`. */
    #[Route('/api/events/{eventId}/seating-plan/tables/{tableId}/duplicate', name: 'seating_tables_duplicate', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function duplicateTable(Request $request, string $eventId, #[InThisEvent('tableId')] SeatingTable $table): JsonResponse
    {
        $event = $this->event($eventId);
        $copy = $this->seatingPlanEditor->duplicateTable($event, $table, $request->headers->get('If-Match'), $this->user());

        return $this->seating($event, $copy->getPlan(), Response::HTTP_CREATED, ['tableId' => $copy->getId()->toRfc4122()]);
    }

    /** Needs If-Match with the table's `version`. */
    #[Route('/api/events/{eventId}/seating-plan/tables/{tableId}', name: 'seating_tables_delete', methods: ['DELETE'])]
    #[InEvent(Permission::SeatingManage)]
    public function deleteTable(Request $request, string $eventId, #[InThisEvent('tableId')] SeatingTable $table): JsonResponse
    {
        $event = $this->event($eventId);
        $plan = $table->getPlan();
        $this->seatingPlanEditor->deleteTable($event, $table, $request->headers->get('If-Match'), $this->user());

        return $this->seating($event, $plan);
    }

    /** Ten seats, labelled with the next free letter, at the room's centre or the nearest free floor. */
    #[Route('/api/events/{eventId}/seating-plan/rows', name: 'seating_rows_add', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function addRow(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $row = $this->seatingPlanEditor->addRow($event, $this->plan($event), $this->user());

        return $this->seating($event, $row->getPlan(), Response::HTTP_CREATED, ['rowId' => $row->getId()->toRfc4122()]);
    }

    /** Any of the fields; needs If-Match with the row's `version` as an ETag. Fewer seats drop from the right-hand end. */
    #[Route('/api/events/{eventId}/seating-plan/rows/{rowId}', name: 'seating_rows_change', methods: ['PATCH'])]
    #[InEvent(Permission::SeatingManage)]
    public function changeRow(Request $request, string $eventId, #[InThisEvent('rowId')] SeatingRow $row): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'label' => Type\optional(Type\string()),
            'sectionId' => Type\optional(Type\nullable(Type\string())),
            'seats' => Type\optional(Type\int()),
            'spacingCm' => Type\optional(Type\int()),
            'rotation' => Type\optional(Type\int()),
            'unusableSeats' => Type\optional(Type\vec(Type\int())),
        ]));

        $this->seatingPlanEditor->changeRow($event, $row, $request->headers->get('If-Match'), $this->user(), $body);

        return $this->seating($event, $row->getPlan(), Response::HTTP_OK, ['rowId' => $row->getId()->toRfc4122()]);
    }

    #[Route('/api/events/{eventId}/seating-plan/rows/{rowId}/duplicate', name: 'seating_rows_duplicate', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function duplicateRow(Request $request, string $eventId, #[InThisEvent('rowId')] SeatingRow $row): JsonResponse
    {
        $event = $this->event($eventId);
        $copy = $this->seatingPlanEditor->duplicateRow($event, $row, $request->headers->get('If-Match'), $this->user());

        return $this->seating($event, $copy->getPlan(), Response::HTTP_CREATED, ['rowId' => $copy->getId()->toRfc4122()]);
    }

    #[Route('/api/events/{eventId}/seating-plan/rows/{rowId}', name: 'seating_rows_delete', methods: ['DELETE'])]
    #[InEvent(Permission::SeatingManage)]
    public function deleteRow(Request $request, string $eventId, #[InThisEvent('rowId')] SeatingRow $row): JsonResponse
    {
        $event = $this->event($eventId);
        $plan = $row->getPlan();
        $this->seatingPlanEditor->deleteRow($event, $row, $request->headers->get('If-Match'), $this->user());

        return $this->seating($event, $plan);
    }

    /** Named "Seat {n}" in the caller's language, at the room's centre or the nearest free floor. */
    #[Route('/api/events/{eventId}/seating-plan/seats', name: 'seating_seats_add', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function addSeat(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $seat = $this->seatingPlanEditor->addSeat($event, $this->plan($event), $this->user());

        return $this->seating($event, $seat->getPlan(), Response::HTTP_CREATED, ['seatId' => $seat->getId()->toRfc4122()]);
    }

    #[Route('/api/events/{eventId}/seating-plan/seats/{seatId}', name: 'seating_seats_change', methods: ['PATCH'])]
    #[InEvent(Permission::SeatingManage)]
    public function changeSeat(Request $request, string $eventId, #[InThisEvent('seatId')] SeatingSeat $seat): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'name' => Type\optional(Type\string()),
            'sectionId' => Type\optional(Type\nullable(Type\string())),
            'unusable' => Type\optional(Type\bool()),
        ]));

        $this->seatingPlanEditor->changeSeat($event, $seat, $request->headers->get('If-Match'), $this->user(), $body);

        return $this->seating($event, $seat->getPlan(), Response::HTTP_OK, ['seatId' => $seat->getId()->toRfc4122()]);
    }

    #[Route('/api/events/{eventId}/seating-plan/seats/{seatId}', name: 'seating_seats_delete', methods: ['DELETE'])]
    #[InEvent(Permission::SeatingManage)]
    public function deleteSeat(Request $request, string $eventId, #[InThisEvent('seatId')] SeatingSeat $seat): JsonResponse
    {
        $event = $this->event($eventId);
        $plan = $seat->getPlan();
        $this->seatingPlanEditor->deleteSeat($event, $seat, $request->headers->get('If-Match'), $this->user());

        return $this->seating($event, $plan);
    }

    /** One step of moves, turns and resizes, saved all or nothing: each item with its `kind`, `id`, `version`, `xCm` and `yCm`, and a table's or row's `rotation`, a table's `widthCm` and `lengthCm` (sc-5028). A stale item refuses the whole step with 412, its problem naming every stale item in `stale`. */
    #[Route('/api/events/{eventId}/seating-plan/furniture', name: 'seating_furniture_arrange', methods: ['PATCH'])]
    #[InEvent(Permission::SeatingManage)]
    public function arrange(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'items' => Type\vec(Type\shape([
                'kind' => self::kind(),
                'id' => Type\string(),
                'version' => Type\int(),
                'xCm' => Type\int(),
                'yCm' => Type\int(),
                'rotation' => Type\optional(Type\int()),
                'widthCm' => Type\optional(Type\int()),
                'lengthCm' => Type\optional(Type\int()),
            ])),
        ]));
        $plan = $this->plan($event);
        $this->seatingPlanEditor->arrange($event, $plan, $this->user(), $body['items']);

        return $this->seating($event, $plan);
    }

    /** Renames the chosen tables in one step, all or nothing (sc-4717's Renumber): each with its `id`, `version` and new `name`. A name kept by a table outside the step refuses it beside that name; a stale table refuses it with 412. */
    #[Route('/api/events/{eventId}/seating-plan/furniture/names', name: 'seating_furniture_rename', methods: ['PATCH'])]
    #[InEvent(Permission::SeatingManage)]
    public function rename(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'items' => Type\vec(Type\shape([
                'id' => Type\string(),
                'version' => Type\int(),
                'name' => Type\string(),
            ])),
        ]));
        $plan = $this->plan($event);
        $this->seatingPlanEditor->renameTables($event, $plan, $this->user(), $body['items']);

        return $this->seating($event, $plan);
    }

    /** Sets each chosen item's `sectionId`, or none with null, in one step, all or nothing (sc-4717's Section). */
    #[Route('/api/events/{eventId}/seating-plan/furniture/sections', name: 'seating_furniture_section', methods: ['PATCH'])]
    #[InEvent(Permission::SeatingManage)]
    public function section(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'items' => Type\vec(Type\shape([
                'kind' => self::kind(),
                'id' => Type\string(),
                'version' => Type\int(),
                'sectionId' => Type\nullable(Type\string()),
            ])),
        ]));
        $plan = $this->plan($event);
        $this->seatingPlanEditor->sectionFurniture($event, $plan, $this->user(), $body['items']);

        return $this->seating($event, $plan);
    }

    /** Copies the chosen items 50 cm down and to the right, with nobody seated, all or nothing (sc-4717); `chosen` lists the copies' ids in reading order. */
    #[Route('/api/events/{eventId}/seating-plan/furniture/duplicate', name: 'seating_furniture_duplicate', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function duplicateFurniture(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $plan = $this->plan($event);
        /** @var list<string> $copies */
        $copies = $this->seatingPlanEditor->duplicateFurniture($event, $plan, $this->user(), $this->chosenItems($request));

        return $this->seating($event, $plan, Response::HTTP_CREATED, ['chosen' => $copies]);
    }

    /** Deletes the chosen items in one step, all or nothing (sc-4717); their guests go back to Without a seat. */
    #[Route('/api/events/{eventId}/seating-plan/furniture/delete', name: 'seating_furniture_delete', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function deleteFurniture(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $plan = $this->plan($event);
        $this->seatingPlanEditor->deleteFurniture($event, $plan, $this->user(), $this->chosenItems($request));

        return $this->seating($event, $plan);
    }

    /** Puts deleted items back, each with its `kind`, `name` (a row's label), `sectionId`, place and layout as the plan served them: the Undo of sc-4717's Delete. `chosen` lists their new ids in the order sent. */
    #[Route('/api/events/{eventId}/seating-plan/furniture/restore', name: 'seating_furniture_restore', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function restore(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'items' => Type\vec(Type\shape([
                'kind' => self::kind(),
                'name' => Type\string(),
                'sectionId' => Type\nullable(Type\string()),
                'xCm' => Type\int(),
                'yCm' => Type\int(),
                'shape' => Type\optional(Type\backed_enum(TableShape::class)),
                'seats' => Type\optional(Type\int()),
                'widthCm' => Type\optional(Type\int()),
                'lengthCm' => Type\optional(Type\int()),
                'endSeats' => Type\optional(Type\int()),
                'rotation' => Type\optional(Type\int()),
                'spacingCm' => Type\optional(Type\int()),
                'unusableSeats' => Type\optional(Type\vec(Type\int())),
                'unusable' => Type\optional(Type\bool()),
            ])),
        ]));
        $plan = $this->plan($event);
        /** @var list<string> $restored */
        $restored = $this->seatingPlanEditor->restoreFurniture($event, $plan, $this->user(), $body['items']);

        return $this->seating($event, $plan, Response::HTTP_CREATED, ['chosen' => $restored]);
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

    /** @param array<string, string|list<string>> $chosen a table's, row's or seat's id as `tableId`, `rowId` or `seatId`, so a client opens the one it added, or the ids it should choose as `chosen` */
    private function seating(Event $event, ?SeatingPlan $plan, int $status = Response::HTTP_OK, array $chosen = []): JsonResponse
    {
        return new JsonResponse(
            ['seating' => $this->seatingSerialiser->seating($event, $plan)] + $chosen,
            $status,
            null === $plan ? [] : ['ETag' => EntityTag::of($plan->getVersion())],
        );
    }

    /** @return list<array{kind: 'table'|'row'|'seat', id: string, version: int}> */
    private function chosenItems(Request $request): array
    {
        return Input::body($request, Type\shape([
            'items' => Type\vec(Type\shape([
                'kind' => self::kind(),
                'id' => Type\string(),
                'version' => Type\int(),
            ])),
        ]))['items'];
    }

    /** @return Type\TypeInterface<'table'|'row'|'seat'> */
    private static function kind(): Type\TypeInterface
    {
        return Type\union(Type\literal_scalar('table'), Type\literal_scalar('row'), Type\literal_scalar('seat'));
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
