<?php

declare(strict_types=1);

namespace App\Domain\Event\DoorCode\Controller;

use App\Domain\Event\DoorCode\DoorCodeLink;
use App\Domain\Event\DoorCode\DoorCodes;
use App\Entity\DoorCode;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\DoorCodeRedemptionRepository;
use App\Repository\DoorCodeRepository;
use App\Repository\EventRepository;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** An event's door codes (sc-72), on its People: seen, made and stopped by whoever manages People there (Owner, Admin, the event's Lead). */
final readonly class DoorCodesController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private DoorCodeRepository $doorCodeRepository,
        private DoorCodeRedemptionRepository $doorCodeRedemptionRepository,
        private DoorCodes $doorCodes,
        private DoorCodeLink $doorCodeLink,
    ) {
    }

    #[Route('/api/events/{eventId}/door-codes', name: 'events_door_codes', methods: ['GET'])]
    #[InEvent(Permission::PeopleManage)]
    public function list(string $eventId): JsonResponse
    {
        $codes = $this->doorCodeRepository->findInPlayOnEvent($this->event($eventId)->getId());
        $used = $this->doorCodeRedemptionRepository->countsFor($codes);

        return new JsonResponse(['doorCodes' => Vec\map($codes, fn (DoorCode $code): array => $this->card($code, $used[$code->getId()->toRfc4122()] ?? 0))]);
    }

    /** `useCap` from 1 to 500 and `expiresAt`, an instant with its offset, are both required; `role` is can_view or can_check_in. `replaces`, a code's id on the same event, is Make a new code: that code stops and leaves the list. */
    #[Route('/api/events/{eventId}/door-codes', name: 'events_door_codes_make', methods: ['POST'])]
    #[InEvent(Permission::PeopleManage)]
    public function make(Request $request, string $eventId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'role' => Type\backed_enum(EventRole::class),
            'jobLabel' => Type\optional(Type\nullable(Type\string())),
            'useCap' => Type\optional(Type\nullable(Type\int())),
            'expiresAt' => Type\optional(Type\nullable(Type\string())),
            'replaces' => Type\optional(Type\nullable(Type\string())),
        ]));
        $event = $this->event($eventId);
        $replaces = null === ($body['replaces'] ?? null) ? null : $this->inPlay($event, $body['replaces']);
        $code = $this->doorCodes->make($event, $body['role'], $body['jobLabel'] ?? null, $body['useCap'] ?? null, $body['expiresAt'] ?? null, $this->user(), $replaces);

        return new JsonResponse(['doorCode' => $this->card($code, 0)], Response::HTTP_CREATED);
    }

    /** Everyone already in keeps their access. */
    #[Route('/api/events/{eventId}/door-codes/{codeId}/stop', name: 'events_door_codes_stop', methods: ['POST'])]
    #[InEvent(Permission::PeopleManage)]
    public function stop(#[InThisEvent('codeId')] DoorCode $code): JsonResponse
    {
        $code = $this->doorCodes->stop($code, $this->user());

        return new JsonResponse(['doorCode' => $this->card($code, $this->doorCodeRedemptionRepository->countFor($code))]);
    }

    /** @return array<string, mixed> */
    private function card(DoorCode $code, int $used): array
    {
        return [
            'id' => $code->getId()->toRfc4122(),
            'code' => $code->getCode(),
            'link' => $this->doorCodeLink->of($code),
            'qrSvg' => $this->doorCodeLink->qrSvgOf($code),
            'role' => $code->getRole()->value,
            'jobLabel' => $code->getJobLabel(),
            'useCap' => $code->getUseCap(),
            'used' => $used,
            'status' => $this->doorCodes->statusOf($code, $used)->value,
            'expiresAt' => $code->getExpiresAt()->format(\DATE_ATOM),
            'stoppedAt' => $code->getStoppedAt()?->format(\DATE_ATOM),
            'createdAt' => $code->getCreatedAt()->format(\DATE_ATOM),
        ];
    }

    private function event(string $id): Event
    {
        return $this->eventRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function inPlay(Event $event, string $id): DoorCode
    {
        $code = Uuid::isValid($id) ? $this->doorCodeRepository->findOneInEvent($event->getId(), Uuid::fromString($id)) : null;

        return null === $code || null !== $code->getReplacedBy() ? throw ApiException::notFound('access.not_found') : $code;
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
