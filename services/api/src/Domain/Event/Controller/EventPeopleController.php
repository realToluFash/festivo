<?php

declare(strict_types=1);

namespace App\Domain\Event\Controller;

use App\Domain\Event\People\EventPeople;
use App\Entity\Event;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventPersonRepository;
use App\Repository\EventRepository;
use App\Repository\MembershipRepository;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** An event's People (sc-29912), members and people from outside (sc-71) together: read by everyone on it, changed by Owners, Admins and its Lead. */
final readonly class EventPeopleController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private EventPersonRepository $eventPersonRepository,
        private EventPeople $eventPeople,
        private MembershipRepository $membershipRepository,
        private MembershipDirectoryInterface $membershipDirectory,
    ) {
    }

    #[Route('/api/events/{eventId}/people', name: 'events_people', methods: ['GET'])]
    #[InEvent(Permission::PeopleRead)]
    public function list(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $member = null !== $this->membershipRepository->findActive($this->user(), $event->getOrganisation()->getId());
        $seesAddresses = $this->managesPeople($event);

        return new JsonResponse([
            'people' => Vec\map($this->eventPersonRepository->findOnEvent($event->getId()), static fn (EventPerson $person): array => self::person($person, $seesAddresses)),
            // Named to every member, so a Member knows whom to ask (sc-29915); someone from outside learns no member beyond the event (sc-71).
            ...($member ? $this->administrators($event) : ['owners' => [], 'admins' => []]),
        ]);
    }

    /** Names only, so a Lead who may not read Members can still add people (sc-29915). */
    #[Route('/api/events/{eventId}/people/addable', name: 'events_people_addable', methods: ['GET'])]
    #[InEvent(Permission::PeopleManage)]
    public function addable(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $on = Vec\filter_nulls(Vec\map($this->eventPersonRepository->findOnEvent($event->getId()), static fn (EventPerson $person): ?string => $person->getMembership()?->getId()->toRfc4122()));
        $self = $this->user()->getId();
        $addable = Vec\filter(
            $this->membershipRepository->findActiveIn($event->getOrganisation()),
            static fn (Membership $membership): bool => !$membership->getUser()->getId()->equals($self) && !Iter\contains($on, $membership->getId()->toRfc4122()),
        );

        return new JsonResponse(['members' => Vec\map($addable, static fn (Membership $membership): array => [
            'membershipId' => $membership->getId()->toRfc4122(),
            'name' => $membership->getUser()->getName(),
        ])]);
    }

    /** Any active member at any of the four roles, by `membershipId`; or someone from outside, by `address`, at any but Lead (sc-71). */
    #[Route('/api/events/{eventId}/people', name: 'events_people_add', methods: ['POST'])]
    #[InEvent(Permission::PeopleManage)]
    public function add(Request $request, string $eventId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'membershipId' => Type\optional(Type\string()),
            'address' => Type\optional(Type\string()),
            'role' => Type\backed_enum(EventRole::class),
            'jobLabel' => Type\optional(Type\nullable(Type\string())),
        ]));
        $event = $this->event($eventId);
        $person = Iter\contains_key($body, 'address')
            ? $this->eventPeople->addFromOutside($event, $body['address'], $body['role'], $body['jobLabel'] ?? null, $this->user())
            : $this->eventPeople->add($event, $body['membershipId'] ?? '', $body['role'], $body['jobLabel'] ?? null, $this->user());

        return new JsonResponse(['person' => self::person($person, true)], Response::HTTP_CREATED);
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

        return new JsonResponse(['person' => self::person($person, true)]);
    }

    #[Route('/api/events/{eventId}/people/{personId}', name: 'events_people_remove', methods: ['DELETE'])]
    #[InEvent(Permission::PeopleManage)]
    public function remove(#[InThisEvent('personId')] EventPerson $person): Response
    {
        $this->eventPeople->remove($person, $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** @return array<string, mixed> an unclaimed address, and its kind, only for whoever manages People (pm #67966) */
    private static function person(EventPerson $person, bool $seesAddresses): array
    {
        $user = $person->getUser();
        $shown = $seesAddresses ? $person->getAddress() : null;

        return [
            'id' => $person->getId()->toRfc4122(),
            'membershipId' => $person->getMembership()?->getId()->toRfc4122(),
            'user' => null === $user ? null : ['id' => $user->getId()->toRfc4122(), 'name' => $user->getName()],
            'role' => $person->getRole()->value,
            'jobLabel' => $person->getJobLabel(),
            'outside' => $person->isOutside(),
            'address' => $shown,
            'addressKind' => null === $shown ? null : $person->getAddressKind()?->value,
            'endsAt' => $person->isOutside() ? $person->getEvent()->getClosesAt()?->format(\DATE_ATOM) : null,
        ];
    }

    private function managesPeople(Event $event): bool
    {
        return true === $this->membershipDirectory->grantsOnEvent($this->user(), $event->getOrganisation()->getId(), $event->getId())?->holds(Permission::PeopleManage);
    }

    /** @return array{owners: list<string>, admins: list<string>} */
    private function administrators(Event $event): array
    {
        $administrators = $this->membershipRepository->findAdministratorsIn($event->getOrganisation());
        $named = static fn (SeededRole $role): array => Vec\map(
            Vec\filter($administrators, static fn (Membership $membership): bool => $membership->getRole()->getSeededAs() === $role),
            static fn (Membership $membership): string => $membership->getUser()->getName(),
        );

        return ['owners' => $named(SeededRole::Owner), 'admins' => $named(SeededRole::Admin)];
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
