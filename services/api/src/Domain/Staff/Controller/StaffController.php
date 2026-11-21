<?php

declare(strict_types=1);

namespace App\Domain\Staff\Controller;

use App\Domain\Staff\Http\StaffSerialiser;
use App\Domain\Staff\StaffRoster;
use App\Domain\Staff\StaffRules;
use App\Entity\Event;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Realtime\SubscriberTokenIssuer;
use App\Repository\EventRepository;
use App\Repository\StaffJobRepository;
use App\Repository\StaffShiftRepository;
use Psl\Iter;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** An event's roster: the people working it, who are not made members (sc-3906). */
final readonly class StaffController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private StaffRules $staffRules,
        private StaffRoster $staffRoster,
        private StaffSerialiser $staffSerialiser,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
        private StaffJobRepository $staffJobRepository,
        private StaffShiftRepository $staffShiftRepository,
    ) {
    }

    #[Route('/api/events/{eventId}/staff', name: 'staff_list', methods: ['GET'])]
    #[InEvent(Permission::StaffRead)]
    public function list(string $eventId): JsonResponse
    {
        return new JsonResponse($this->staffSerialiser->list($this->event($eventId)));
    }

    /** Refused `validation_failed` on each field at once, and 409 `staff_number_shared` naming `sharedWith` until `allowShared`; `shift` is refused as Assign refuses it. `member` names the account it linked to. */
    #[Route('/api/events/{eventId}/staff', name: 'staff_add', methods: ['POST'])]
    #[InEvent(Permission::StaffManage)]
    public function add(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, self::shape());
        $details = $this->staffRules->details($body['fullName'], $body['mobile'] ?? null, $body['email'] ?? null);
        $job = $this->job($event, $body['job'] ?? null);
        $shift = null === ($body['shift'] ?? null) ? null : $this->staffShiftRepository->findOneInEvent($event->getId(), $this->uuid($body['shift'])) ?? throw ApiException::notFound('access.not_found');

        return $this->answered($this->staffRoster->add($event, $details, $job, $shift, $this->user(), $body['allowShared'] ?? false), Response::HTTP_CREATED);
    }

    /** The whole entry, its job kept when `job` is left out. Once its contacts are erased, `mobile` and `email` are ignored. Refused 409 `staff_on_shifts` when someone on a shift would change job. */
    #[Route('/api/events/{eventId}/staff/{staffId}', name: 'staff_edit', methods: ['PUT'])]
    #[InEvent(Permission::StaffManage)]
    public function edit(Request $request, #[InThisEvent('staffId')] StaffMember $entry): JsonResponse
    {
        $body = Input::body($request, self::shape());
        $details = null === $entry->getContactsErasedAt()
            ? $this->staffRules->details($body['fullName'], $body['mobile'] ?? null, $body['email'] ?? null)
            : $this->staffRules->details($body['fullName'], null, null);

        $job = Iter\contains_key($body, 'job') ? $this->job($entry->getEvent(), $body['job'] ?? null) : $entry->getJob();

        return $this->answered($this->staffRoster->edit($entry, $details, $job, $this->user(), $body['allowShared'] ?? false), Response::HTTP_OK);
    }

    /** Refused 409 `event_concluded` once the event has finished. */
    #[Route('/api/events/{eventId}/staff/{staffId}', name: 'staff_remove', methods: ['DELETE'])]
    #[InEvent(Permission::StaffManage)]
    public function remove(#[InThisEvent('staffId')] StaffMember $entry): Response
    {
        $this->staffRoster->remove($entry, $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** A hub token for this event's roster; every change publishes the whole roster there. */
    #[Route('/api/events/{eventId}/staff/subscriptions', name: 'staff_subscribe', methods: ['POST'])]
    #[InEvent(Permission::StaffRead)]
    public function subscribe(string $eventId): JsonResponse
    {
        $issued = $this->subscriberTokenIssuer->issueForEventStaff($this->event($eventId)->getId());

        return new JsonResponse([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->format(\DATE_ATOM),
        ]);
    }

    /** @return Type\TypeInterface<array{fullName: string, mobile?: ?array{countryCode: string, number: string}, email?: ?string, job?: ?string, shift?: ?string, allowShared?: bool}> */
    private static function shape(): Type\TypeInterface
    {
        return Type\shape([
            'fullName' => Type\string(),
            'mobile' => Type\optional(Type\nullable(Type\shape([
                'countryCode' => Type\string(),
                'number' => Type\string(),
            ]))),
            'email' => Type\optional(Type\nullable(Type\string())),
            'job' => Type\optional(Type\nullable(Type\string())),
            'shift' => Type\optional(Type\nullable(Type\string())),
            'allowShared' => Type\optional(Type\bool()),
        ]);
    }

    private function answered(StaffMember $entry, int $status): JsonResponse
    {
        return new JsonResponse([
            'staff' => $this->staffSerialiser->entry($entry),
            'member' => $entry->getMember()?->getName(),
        ], $status);
    }

    private function job(Event $event, ?string $id): ?StaffJob
    {
        return null === $id ? null : $this->staffJobRepository->findOneInEvent($event->getId(), $this->uuid($id)) ?? throw ApiException::notFound('access.not_found');
    }

    private function uuid(string $id): Uuid
    {
        return Uuid::isValid($id) ? Uuid::fromString($id) : throw ApiException::notFound('access.not_found');
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
