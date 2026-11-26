<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Guest\Arrival\Arrivals;
use App\Domain\Guest\GuestRules;
use App\Domain\Guest\Http\CheckInSerialiser;
use App\Domain\User\Device\DeviceIdentity;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Exception\ShapeRefusal;
use App\Http\Input;
use App\Realtime\SubscriberTokenIssuer;
use App\Repository\EventRepository;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Check-in at the door (sc-1454), for guests.check_in holders: Can view is refused 403. Each change answers with the door's list as it now stands; outside the window it is refused 409 `check_in_closed`. */
final readonly class CheckInController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private Arrivals $arrivals,
        private GuestRules $guestRules,
        private CheckInSerialiser $checkInSerialiser,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
        private ClockInterface $clock,
    ) {
    }

    #[Route('/api/events/{eventId}/check-in', name: 'check_in_show', methods: ['GET'])]
    #[InEvent(Permission::GuestsCheckIn)]
    public function show(string $eventId): JsonResponse
    {
        return $this->read($this->event($eventId));
    }

    /** A guest or a companion, by `guestId`; one already arrived keeps their first arrival. `arrivedAt` is when a device that was offline recorded it (sc-1301): the earlier of two arrivals stands, and one from the future is taken as now. */
    #[Route('/api/events/{eventId}/check-in/arrivals', name: 'check_in_arrive', methods: ['POST'])]
    #[InEvent(Permission::GuestsCheckIn)]
    public function arrive(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape(['guestId' => Type\string(), 'arrivedAt' => Type\optional(Type\string())]));
        $at = null === ($body['arrivedAt'] ?? null) ? null : self::instant($body['arrivedAt']);

        if (false === $at) {
            throw new ShapeRefusal('arrivedAt', ShapeRefusal::FIELD);
        }

        $this->arrivals->arrive($event, $body['guestId'], $this->user(), DeviceIdentity::of($request), DeviceIdentity::clientOf($request), $at?->setTimezone(new DateTimeZone('UTC')));

        return $this->read($event);
    }

    #[Route('/api/events/{eventId}/check-in/arrivals/{guestId}', name: 'check_in_undo', methods: ['DELETE'])]
    #[InEvent(Permission::GuestsCheckIn)]
    public function undo(Request $request, string $eventId, string $guestId): JsonResponse
    {
        $event = $this->event($eventId);
        $this->arrivals->undo($event, $guestId, $this->user(), DeviceIdentity::of($request), DeviceIdentity::clientOf($request));

        return $this->read($event);
    }

    /** A full name only, at most 200 characters; 409 `guest_already_listed` names who is already there, with `guest`, unless `allowDuplicate`. */
    #[Route('/api/events/{eventId}/check-in/walk-ins', name: 'check_in_walk_in', methods: ['POST'])]
    #[InEvent(Permission::GuestsCheckIn)]
    public function walkIn(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'fullName' => Type\string(),
            'allowDuplicate' => Type\optional(Type\bool()),
        ]));
        $new = $this->guestRules->guest($body['fullName'], null, null, []);
        $guest = $this->arrivals->walkIn($event, $new, $this->user(), DeviceIdentity::of($request), DeviceIdentity::clientOf($request), $body['allowDuplicate'] ?? false);

        return new JsonResponse(['walkIn' => ['id' => $guest->getId()->toRfc4122()], ...$this->checkInSerialiser->read($event, $this->now())], Response::HTTP_CREATED);
    }

    /** A hub token for the door's signal alone: it says the list changed and carries nothing else, so the screen reads it again through this API. */
    #[Route('/api/events/{eventId}/check-in/subscriptions', name: 'check_in_subscribe', methods: ['POST'])]
    #[InEvent(Permission::GuestsCheckIn)]
    public function subscribe(string $eventId): JsonResponse
    {
        $issued = $this->subscriberTokenIssuer->issueForCheckIn($this->event($eventId)->getId());

        return new JsonResponse([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->format(\DATE_ATOM),
        ]);
    }

    /** RFC 3339 with or without milliseconds, as `Date.toISOString()` writes it. */
    private static function instant(string $value): DateTimeImmutable|false
    {
        return DateTimeImmutable::createFromFormat(\DATE_ATOM, $value) ?: DateTimeImmutable::createFromFormat(\DATE_RFC3339_EXTENDED, $value);
    }

    private function read(Event $event): JsonResponse
    {
        return new JsonResponse($this->checkInSerialiser->read($event, $this->now()));
    }

    private function now(): DateTimeImmutable
    {
        return DateTimeImmutable::createFromInterface($this->clock->now());
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
