<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Guest\GuestAdder;
use App\Domain\Guest\GuestEditor;
use App\Domain\Guest\GuestRules;
use App\Domain\Guest\Http\GuestSerialiser;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InEvent;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Realtime\SubscriberTokenIssuer;
use App\Repository\EventRepository;
use App\Repository\GuestRepository;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** An event's guest list and adding to it (sc-1468); one guest's details and correcting them (sc-3773). */
final readonly class GuestsController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private GuestRules $guestRules,
        private GuestAdder $guestAdder,
        private GuestEditor $guestEditor,
        private GuestRepository $guestRepository,
        private MembershipDirectoryInterface $membershipDirectory,
        private GuestSerialiser $guestSerialiser,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
    ) {
    }

    #[Route('/api/events/{eventId}/guests', name: 'guests_list', methods: ['GET'])]
    #[InEvent(Permission::GuestsRead)]
    public function list(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);

        return new JsonResponse($this->guestSerialiser->list($event, $this->seesContacts($event)));
    }

    /** Refused `validation_failed` on each field at once, and 409 `guest_already_listed` until `allowDuplicate`. */
    #[Route('/api/events/{eventId}/guests', name: 'guests_add', methods: ['POST'])]
    #[InEvent(Permission::GuestsManage)]
    public function add(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'fullName' => Type\string(),
            'email' => Type\optional(Type\nullable(Type\string())),
            'mobile' => Type\optional(Type\nullable(Type\shape([
                'countryCode' => Type\string(),
                'number' => Type\string(),
            ]))),
            'companions' => Type\optional(Type\vec(Type\shape([
                'fullName' => Type\optional(Type\nullable(Type\string())),
                'needs' => Type\optional(Type\nullable(self::needsShape())),
            ]))),
            'needs' => Type\optional(Type\nullable(self::needsShape())),
            'language' => Type\optional(Type\nullable(Type\string())),
            'allowDuplicate' => Type\optional(Type\bool()),
        ]));

        $new = $this->guestRules->guest(
            $body['fullName'],
            $body['email'] ?? null,
            $body['mobile'] ?? null,
            Vec\map($body['companions'] ?? [], static fn (array $companion): ?string => $companion['fullName'] ?? null),
            $body['language'] ?? null,
            $body['needs'] ?? null,
            Vec\map($body['companions'] ?? [], static fn (array $companion): ?array => $companion['needs'] ?? null),
        );
        $guest = $this->guestAdder->add($event, $new, $this->user(), $body['allowDuplicate'] ?? false);
        $added = Iter\search($this->guestSerialiser->list($event, contacts: true)['guests'], static fn (array $row): bool => $row['id'] === $guest->getId()->toRfc4122());

        return new JsonResponse(['guest' => $added], Response::HTTP_CREATED);
    }

    #[Route('/api/events/{eventId}/guests/{guestId}', name: 'guests_show', methods: ['GET'])]
    #[InEvent(Permission::GuestsRead)]
    public function show(string $eventId, string $guestId): JsonResponse
    {
        $event = $this->event($eventId);

        return $this->tagged($this->guest($event, $guestId), $this->seesContacts($event));
    }

    /** The whole guest: a companion without an `id` is added and one left out removed; a body without `language` or `needs`, or a companion without `needs`, keeps them, since a form that does not show a field never changes it. Needs If-Match (sc-3587). */
    #[Route('/api/events/{eventId}/guests/{guestId}', name: 'guests_update', methods: ['PUT'])]
    #[InEvent(Permission::GuestsManage)]
    public function update(Request $request, string $eventId, string $guestId): JsonResponse
    {
        $guest = $this->guest($this->event($eventId), $guestId);
        $body = Input::body($request, Type\shape([
            'fullName' => Type\string(),
            'email' => Type\optional(Type\nullable(Type\string())),
            'mobile' => Type\optional(Type\nullable(Type\shape([
                'countryCode' => Type\string(),
                'number' => Type\string(),
            ]))),
            'companions' => Type\optional(Type\vec(Type\shape([
                'id' => Type\optional(Type\nullable(Type\string())),
                'fullName' => Type\optional(Type\nullable(Type\string())),
                'needs' => Type\optional(Type\nullable(self::needsShape())),
            ]))),
            'needs' => Type\optional(Type\nullable(self::needsShape())),
            'language' => Type\optional(Type\nullable(Type\string())),
            'allowDuplicate' => Type\optional(Type\bool()),
        ]));
        $companions = $body['companions'] ?? [];

        $new = $this->guestRules->guest(
            $body['fullName'],
            $body['email'] ?? null,
            $body['mobile'] ?? null,
            Vec\map($companions, static fn (array $companion): ?string => $companion['fullName'] ?? null),
            Iter\contains_key($body, 'language') ? $body['language'] : $guest->getLanguage(),
            $body['needs'] ?? null,
            Vec\map($companions, static fn (array $companion): ?array => $companion['needs'] ?? null),
        );
        $ids = Vec\map($companions, static fn (array $companion): ?string => $companion['id'] ?? null);

        return $this->tagged(
            $this->guestEditor->edit($guest, $request->headers->get('If-Match'), $new, $ids, $this->user(), $body['allowDuplicate'] ?? false),
            contacts: true,
        );
    }

    /** A hub token for this event's guest list and its headcount; each add and edit publishes the whole list there, without contacts, so a manager reads them again. */
    #[Route('/api/events/{eventId}/guests/subscriptions', name: 'guests_subscribe', methods: ['POST'])]
    #[InEvent(Permission::GuestsRead)]
    public function subscribe(string $eventId): JsonResponse
    {
        $issued = $this->subscriberTokenIssuer->issueForEventGuests($this->event($eventId)->getId());

        return new JsonResponse([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->format(\DATE_ATOM),
        ]);
    }

    /** @return Type\TypeInterface<array{allergies?: list<string>, diet?: list<string>, access?: list<string>, otherAllergy?: ?string, otherDiet?: ?string, otherAccess?: ?string, note?: ?string}> */
    private static function needsShape(): Type\TypeInterface
    {
        return Type\shape([
            'allergies' => Type\optional(Type\vec(Type\string())),
            'diet' => Type\optional(Type\vec(Type\string())),
            'access' => Type\optional(Type\vec(Type\string())),
            'otherAllergy' => Type\optional(Type\nullable(Type\string())),
            'otherDiet' => Type\optional(Type\nullable(Type\string())),
            'otherAccess' => Type\optional(Type\nullable(Type\string())),
            'note' => Type\optional(Type\nullable(Type\string())),
        ]);
    }

    private function tagged(Guest $guest, bool $contacts): JsonResponse
    {
        return new JsonResponse(['guest' => $this->guestSerialiser->details($guest, $contacts)], Response::HTTP_OK, ['ETag' => EntityTag::of($guest->getVersion())]);
    }

    private function guest(Event $event, string $id): Guest
    {
        return $this->guestRepository->findHostOn($event, $id) ?? throw ApiException::notFound('access.not_found');
    }

    private function seesContacts(Event $event): bool
    {
        return $this->membershipDirectory->grantsOnEvent($this->user(), $event->getOrganisation()->getId(), $event->getId())?->holds(Permission::GuestsManage) ?? false;
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
