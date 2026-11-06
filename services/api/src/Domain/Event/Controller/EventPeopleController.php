<?php

declare(strict_types=1);

namespace App\Domain\Event\Controller;

use App\Domain\Event\People\EventPeople;
use App\Entity\Event;
use App\Entity\EventPerson;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventPersonRepository;
use App\Repository\EventRepository;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** An event's People (sc-29912): read by everyone on it and by its organisation's Owners and Admins, changed by those and its Lead. */
final readonly class EventPeopleController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private EventPersonRepository $eventPersonRepository,
        private EventPeople $eventPeople,
    ) {
    }

    #[Route('/api/events/{eventId}/people', name: 'events_people', methods: ['GET'])]
    #[InEvent(Permission::PeopleRead)]
    public function list(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);

        return new JsonResponse(['people' => Vec\map($this->eventPersonRepository->findOnEvent($event->getId()), self::person(...))]);
    }

    /** Any active member at any of the four roles. Someone from outside the organisation is sc-71's grant. */
    #[Route('/api/events/{eventId}/people', name: 'events_people_add', methods: ['POST'])]
    #[InEvent(Permission::PeopleManage)]
    public function add(Request $request, string $eventId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'membershipId' => Type\string(),
            'role' => Type\backed_enum(EventRole::class),
            'jobLabel' => Type\optional(Type\nullable(Type\string())),
        ]));
        $person = $this->eventPeople->add($this->event($eventId), $body['membershipId'], $body['role'], $body['jobLabel'] ?? null, $this->user());

        return new JsonResponse(['person' => self::person($person)], Response::HTTP_CREATED);
    }

    /** Applies on the person's next request; nobody is signed out. */
    #[Route('/api/events/{eventId}/people/{personId}', name: 'events_people_change', methods: ['PATCH'])]
    #[InEvent(Permission::PeopleManage)]
    public function change(Request $request, #[InThisEvent('personId')] EventPerson $person): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'role' => Type\optional(Type\backed_enum(EventRole::class)),
            'jobLabel' => Type\optional(Type\nullable(Type\string())),
        ]));
        $person = $this->eventPeople->change($person, $body['role'] ?? null, $body['jobLabel'] ?? null, Iter\contains_key($body, 'jobLabel'), $this->user());

        return new JsonResponse(['person' => self::person($person)]);
    }

    #[Route('/api/events/{eventId}/people/{personId}', name: 'events_people_remove', methods: ['DELETE'])]
    #[InEvent(Permission::PeopleManage)]
    public function remove(#[InThisEvent('personId')] EventPerson $person): Response
    {
        $this->eventPeople->remove($person, $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** @return array<string, mixed> */
    private static function person(EventPerson $person): array
    {
        $membership = $person->getMembership();
        $user = $membership->getUser();

        return [
            'id' => $person->getId()->toRfc4122(),
            'membershipId' => $membership->getId()->toRfc4122(),
            'user' => ['id' => $user->getId()->toRfc4122(), 'name' => $user->getName()],
            'role' => $person->getRole()->value,
            'jobLabel' => $person->getJobLabel(),
            // Somebody from outside arrives with sc-71's grant; until then everybody here is a member.
            'outside' => false,
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
