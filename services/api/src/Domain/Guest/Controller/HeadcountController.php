<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Guest\Headcount\HeadcountCalculator;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InEvent;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Realtime\SubscriberTokenIssuer;
use App\Repository\EventRepository;
use App\Repository\OrganisationRepository;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** How many are coming, for whatever shows a count (sc-99); each change is published on the event's headcount topic, which the guest list's hub token covers. */
final readonly class HeadcountController
{
    private const int MOST_EVENTS = 200;

    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private OrganisationRepository $organisationRepository,
        private MembershipDirectoryInterface $membershipDirectory,
        private HeadcountCalculator $headcountCalculator,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
    ) {
    }

    #[Route('/api/events/{eventId}/headcount', name: 'guests_headcount', methods: ['GET'])]
    #[InEvent(Permission::GuestsRead)]
    public function show(string $eventId): JsonResponse
    {
        $event = $this->eventRepository->find($eventId) ?? throw ApiException::notFound('access.not_found');

        return new JsonResponse(['headcount' => $this->headcountCalculator->forEvent($event)]);
    }

    /** A hub token for the headcounts of the events Events shows (sc-3786), each one the caller reads guests on; an event they do not is left out, as it is from the list's figures. */
    #[Route('/api/orgs/{organisationId}/events/headcounts/subscriptions', name: 'guests_headcounts_subscribe', methods: ['POST'])]
    #[InOrganisation(null)]
    public function subscribe(Request $request, string $organisationId): JsonResponse
    {
        $body = Input::body($request, Type\shape(['events' => Type\vec(Type\string())]));
        $organisation = $this->organisationRepository->find($organisationId) ?? throw ApiException::notFound('access.not_found');
        $scope = $this->membershipDirectory->eventScopeIn($this->user(), $organisation->getId()) ?? throw ApiException::notFound('access.not_found');
        $ids = Vec\map(Vec\filter(Vec\take($body['events'], self::MOST_EVENTS), Uuid::isValid(...)), Uuid::fromString(...));
        $events = [] === $ids ? [] : $this->eventRepository->findBy(['id' => $ids, 'organisation' => $organisation]);
        $read = Vec\filter($events, static fn (Event $event): bool => $scope->on($event->getId())?->holds(Permission::GuestsRead) ?? false);
        $issued = $this->subscriberTokenIssuer->issueForHeadcounts(Vec\map($read, static fn (Event $event): Uuid => $event->getId()));

        return new JsonResponse([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->format(\DATE_ATOM),
        ]);
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
