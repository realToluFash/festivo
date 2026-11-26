<?php

declare(strict_types=1);

namespace App\Domain\Staff\Controller;

use App\Domain\Staff\Http\StaffSerialiser;
use App\Domain\Staff\Station\StationPlan;
use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\StaffMember;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffStationRepository;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** An event's stations (sc-3910). Each change answers the whole staff list, stations in it, as the roster's topic publishes it; staff.read reads them there. */
final readonly class StationController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private StaffStationRepository $staffStationRepository,
        private StaffMemberRepository $staffMemberRepository,
        private StationPlan $stationPlan,
        private StaffSerialiser $staffSerialiser,
    ) {
    }

    /** Refused `validation_failed` on `name`. */
    #[Route('/api/events/{eventId}/stations/places', name: 'station_place_add', methods: ['POST'])]
    #[InEvent(Permission::StaffManage)]
    public function addPlace(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $this->stationPlan->addPlace($event, Input::body($request, self::nameShape())['name'], $this->user());

        return $this->answered($event, Response::HTTP_CREATED);
    }

    /** Refused `validation_failed` on `name`, and for the Pass. */
    #[Route('/api/events/{eventId}/stations/places/{placeId}', name: 'station_place_rename', methods: ['PUT'])]
    #[InEvent(Permission::StaffManage)]
    public function renamePlace(Request $request, string $eventId, string $placeId): JsonResponse
    {
        $event = $this->event($eventId);
        $this->stationPlan->renamePlace($this->place($event, $placeId), Input::body($request, self::nameShape())['name'], $this->user());

        return $this->answered($event, Response::HTTP_OK);
    }

    /** Refused `validation_failed` for the Pass. */
    #[Route('/api/events/{eventId}/stations/places/{placeId}', name: 'station_place_remove', methods: ['DELETE'])]
    #[InEvent(Permission::StaffManage)]
    public function removePlace(string $eventId, string $placeId): JsonResponse
    {
        $event = $this->event($eventId);
        $this->stationPlan->removePlace($this->place($event, $placeId), $this->user());

        return $this->answered($event, Response::HTTP_OK);
    }

    /** `station` is a place's id or a seating section's, or null for none. */
    #[Route('/api/events/{eventId}/stations/people/{staffId}', name: 'station_person', methods: ['PUT'])]
    #[InEvent(Permission::StaffManage)]
    public function person(Request $request, #[InThisEvent('staffId')] StaffMember $person): JsonResponse
    {
        $body = Input::body($request, Type\shape(['station' => Type\nullable(Type\string())]));
        $this->stationPlan->place($person, $body['station'], $this->user());

        return $this->answered($person->getEvent(), Response::HTTP_OK);
    }

    #[Route('/api/events/{eventId}/stations/floor-lead', name: 'station_floor_lead', methods: ['PUT'])]
    #[InEvent(Permission::StaffManage)]
    public function floorLead(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, self::leadShape());
        $this->stationPlan->floorLead($event, $this->staffMember($event, $body['lead']), $this->user());

        return $this->answered($event, Response::HTTP_OK);
    }

    /** Refused `validation_failed` on `order` unless it is exactly the walking order's stations. */
    #[Route('/api/events/{eventId}/stations/walking-order', name: 'station_walk', methods: ['PUT'])]
    #[InEvent(Permission::StaffManage)]
    public function walk(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape(['order' => Type\vec(Type\string())]));
        $this->stationPlan->walk($event, $body['order'], $this->user());

        return $this->answered($event, Response::HTTP_OK);
    }

    /** Refused `validation_failed` on `place` for anything but one of the event's places, and on `item` for one not on the course. */
    #[Route('/api/events/{eventId}/stations/courses/{courseId}/dished-at', name: 'station_dished_at', methods: ['PUT'])]
    #[InEvent(Permission::StaffManage)]
    public function dishedAt(Request $request, #[InThisEvent('courseId')] MenuCourse $course): JsonResponse
    {
        $body = Input::body($request, Type\shape(['item' => Type\string(), 'place' => Type\string()]));
        $this->stationPlan->dishAt($course, $body['item'], $body['place'], $this->user());

        return $this->answered($course->getEvent(), Response::HTTP_OK);
    }

    /** `stationId` is a place's id or a seating section's. Refused `validation_failed` on `lead` for somebody not on it. */
    #[Route('/api/events/{eventId}/stations/{stationId}/lead', name: 'station_lead', methods: ['PUT'])]
    #[InEvent(Permission::StaffManage)]
    public function lead(Request $request, string $eventId, string $stationId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, self::leadShape());
        $this->stationPlan->lead($event, $stationId, $this->staffMember($event, $body['lead']), $this->user());

        return $this->answered($event, Response::HTTP_OK);
    }

    /** @return Type\TypeInterface<array{name: string}> */
    private static function nameShape(): Type\TypeInterface
    {
        return Type\shape(['name' => Type\string()]);
    }

    /** @return Type\TypeInterface<array{lead: ?string}> */
    private static function leadShape(): Type\TypeInterface
    {
        return Type\shape(['lead' => Type\nullable(Type\string())]);
    }

    private function answered(Event $event, int $status): JsonResponse
    {
        return new JsonResponse($this->staffSerialiser->list($event), $status);
    }

    private function place(Event $event, string $id): StaffStation
    {
        $place = Uuid::isValid($id) ? $this->staffStationRepository->findOneInEvent($event, Uuid::fromString($id)) : null;

        return null !== $place && $place->isPlace() ? $place : throw ApiException::notFound('access.not_found');
    }

    private function staffMember(Event $event, ?string $id): ?StaffMember
    {
        if (null === $id) {
            return null;
        }

        $person = Uuid::isValid($id) ? $this->staffMemberRepository->findOneInEvent($event->getId(), Uuid::fromString($id)) : null;

        return $person ?? throw ApiException::notFound('access.not_found');
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
