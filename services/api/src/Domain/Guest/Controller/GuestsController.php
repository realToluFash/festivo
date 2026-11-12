<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Guest\GuestAdder;
use App\Domain\Guest\GuestRules;
use App\Domain\Guest\Http\GuestSerialiser;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Realtime\SubscriberTokenIssuer;
use App\Repository\EventRepository;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** An event's guest list and adding to it (sc-1468). */
final readonly class GuestsController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private GuestRules $guestRules,
        private GuestAdder $guestAdder,
        private GuestSerialiser $guestSerialiser,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
    ) {
    }

    #[Route('/api/events/{eventId}/guests', name: 'guests_list', methods: ['GET'])]
    #[InEvent(Permission::GuestsRead)]
    public function list(string $eventId): JsonResponse
    {
        return new JsonResponse($this->guestSerialiser->list($this->event($eventId)));
    }

    /**
     * Refused `validation_failed` on `fullName`, `email`, `mobile`, `countryCode`, `companions` or `companions[i].fullName`,
     * and 409 `guest_already_listed` when the name is on the list already and `allowDuplicate` is not true.
     */
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
            ]))),
            'allowDuplicate' => Type\optional(Type\bool()),
        ]));

        $new = $this->guestRules->guest(
            $body['fullName'],
            $body['email'] ?? null,
            $body['mobile'] ?? null,
            Vec\map($body['companions'] ?? [], static fn (array $companion): ?string => $companion['fullName'] ?? null),
        );
        $guest = $this->guestAdder->add($event, $new, $this->user(), $body['allowDuplicate'] ?? false);
        $added = Iter\search($this->guestSerialiser->list($event)['guests'], static fn (array $row): bool => $row['id'] === $guest->getId()->toRfc4122());

        return new JsonResponse(['guest' => $added], Response::HTTP_CREATED);
    }

    /** A hub token for this event's guest list alone; each add publishes the whole list there. */
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
