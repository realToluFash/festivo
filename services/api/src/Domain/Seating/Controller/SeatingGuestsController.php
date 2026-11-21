<?php

declare(strict_types=1);

namespace App\Domain\Seating\Controller;

use App\Domain\Seating\GuestSeater;
use App\Domain\Seating\Http\SeatingSerialiser;
use App\Domain\Seating\Moved;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\SeatingPlan;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\GuestRepository;
use App\Repository\SeatingPlanRepository;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** Who sits where (sc-4013): each action answers the plan, its `moves` (a guest's `from` and `to` chair, null for Without a seat) and `apart`; its moves sent to `undo` put it back. */
final readonly class SeatingGuestsController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private GuestRepository $guestRepository,
        private SeatingPlanRepository $seatingPlanRepository,
        private GuestSeater $guestSeater,
        private SeatingSerialiser $seatingSerialiser,
    ) {
    }

    /** With their party unless `justGuest`; refused 409 `seating_table_full`, `seating_table_short` (with `free` and `party`), `seating_seat_taken` or `seating_guest_not_waiting`. */
    #[Route('/api/events/{eventId}/seating-plan/guests/seat', name: 'seating_guests_seat', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function seat(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $plan = $this->plan($event);
        $body = Input::body($request, Type\shape([
            'guestId' => Type\string(),
            'kind' => self::kind(),
            'placeId' => Type\string(),
            'seat' => Type\optional(Type\nullable(Type\int())),
            'justGuest' => Type\optional(Type\bool()),
        ]));

        $done = $this->guestSeater->seat($event, $plan, $this->user(), $this->guest($event, $body['guestId']), $this->guestSeater->placeIn($plan, $body['kind'], $body['placeId']), $body['seat'] ?? null, $body['justGuest'] ?? false);

        return $this->answered($event, $plan, $done);
    }

    #[Route('/api/events/{eventId}/seating-plan/guests/swap', name: 'seating_guests_swap', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function swap(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $plan = $this->plan($event);
        $body = Input::body($request, Type\shape([
            'guestId' => Type\string(),
            'withGuestId' => Type\string(),
        ]));

        $done = $this->guestSeater->swap($event, $plan, $this->user(), $this->guest($event, $body['guestId']), $this->guest($event, $body['withGuestId']));

        return $this->answered($event, $plan, $done);
    }

    #[Route('/api/events/{eventId}/seating-plan/guests/unseat', name: 'seating_guests_unseat', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function unseat(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $plan = $this->plan($event);
        $body = Input::body($request, Type\shape([
            'guestIds' => Type\optional(Type\vec(Type\string())),
            'kind' => Type\optional(self::kind()),
            'placeId' => Type\optional(Type\string()),
        ]));
        $place = isset($body['kind'], $body['placeId']) ? $this->guestSeater->placeIn($plan, $body['kind'], $body['placeId']) : null;
        $guests = Vec\map($body['guestIds'] ?? [], fn (string $id): Guest => $this->guest($event, $id));

        $done = $this->guestSeater->unseat($event, $plan, $this->user(), $guests, $place);

        return $this->answered($event, $plan, $done);
    }

    #[Route('/api/events/{eventId}/seating-plan/guests/move-everyone', name: 'seating_guests_move_everyone', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function moveEveryone(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $plan = $this->plan($event);
        $place = Type\shape(['kind' => self::kind(), 'id' => Type\string()]);
        $body = Input::body($request, Type\shape(['from' => $place, 'to' => $place]));

        $done = $this->guestSeater->moveEveryone(
            $event,
            $plan,
            $this->user(),
            $this->guestSeater->placeIn($plan, $body['from']['kind'], $body['from']['id']),
            $this->guestSeater->placeIn($plan, $body['to']['kind'], $body['to']['id']),
        );

        return $this->answered($event, $plan, $done);
    }

    /** All or nothing: 409 `seating_undo_stale` once any guest moved since or any chair they return to was taken. */
    #[Route('/api/events/{eventId}/seating-plan/guests/undo', name: 'seating_guests_undo', methods: ['POST'])]
    #[InEvent(Permission::SeatingManage)]
    public function undo(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $plan = $this->plan($event);
        $chair = Type\nullable(Type\shape(['kind' => self::kind(), 'id' => Type\string(), 'seat' => Type\int()]));
        $body = Input::body($request, Type\shape([
            'moves' => Type\vec(Type\shape(['guestId' => Type\string(), 'from' => $chair, 'to' => $chair])),
        ]));

        $moves = [];
        foreach ($body['moves'] as $move) {
            try {
                $moves[] = [
                    'guest' => $this->guest($event, $move['guestId']),
                    'from' => null === $move['from'] ? null : ['place' => $this->guestSeater->placeIn($plan, $move['from']['kind'], $move['from']['id']), 'seat' => $move['from']['seat']],
                    'to' => null === $move['to'] ? null : ['place' => $this->guestSeater->placeIn($plan, $move['to']['kind'], $move['to']['id']), 'seat' => $move['to']['seat']],
                ];
            } catch (ApiException $gone) {
                throw new ApiException(ErrorCode::SeatingUndoStale, 'seating.undo_stale', previous: $gone);
            }
        }

        $done = $this->guestSeater->undo($event, $plan, $this->user(), $moves);

        return $this->answered($event, $plan, $done);
    }

    private function answered(Event $event, SeatingPlan $plan, Moved $done): JsonResponse
    {
        return new JsonResponse(
            [
                'seating' => $this->seatingSerialiser->seating($event, $plan),
                'moves' => Vec\map($done->moves, static fn (array $move): array => [
                    'guestId' => $move['guest']->getId()->toRfc4122(),
                    'from' => null === $move['from'] ? null : GuestSeater::refOf($move['from']['place'], $move['from']['seat']),
                    'to' => null === $move['to'] ? null : GuestSeater::refOf($move['to']['place'], $move['to']['seat']),
                ]),
                'apart' => $done->apart,
            ],
            200,
            ['ETag' => EntityTag::of($plan->getVersion())],
        );
    }

    /** @return Type\TypeInterface<'table'|'row'|'seat'> */
    private static function kind(): Type\TypeInterface
    {
        return Type\union(Type\literal_scalar('table'), Type\literal_scalar('row'), Type\literal_scalar('seat'));
    }

    private function guest(Event $event, string $id): Guest
    {
        $guest = Uuid::isValid($id) ? $this->guestRepository->findOneInEvent($event->getId(), Uuid::fromString($id)) : null;

        return $guest ?? throw ApiException::notFound('access.not_found');
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
