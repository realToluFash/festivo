<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Controller;

use App\Domain\Messaging\GuestMessages\GuestMessageSender;
use App\Domain\Messaging\GuestMessages\GuestMessageSerialiser;
use App\Domain\Messaging\Model\PlannedDelivery;
use App\Entity\Event;
use App\Entity\GuestMessage;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\GuestMessageRepository;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** An event's messages to its guests (sc-3942): All messages, one message's deliveries, the check before Send, and Send. */
final readonly class GuestMessagesController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private GuestMessageRepository $guestMessageRepository,
        private GuestMessageSender $guestMessageSender,
        private GuestMessageSerialiser $guestMessageSerialiser,
        private MembershipDirectoryInterface $membershipDirectory,
    ) {
    }

    #[Route('/api/events/{eventId}/messages', name: 'guest_messages_list', methods: ['GET'])]
    #[InEvent(Permission::MessagesRead)]
    public function list(string $eventId): JsonResponse
    {
        return new JsonResponse(['messages' => $this->guestMessageSerialiser->list($this->guestMessageRepository->findOn($this->event($eventId)))]);
    }

    #[Route('/api/events/{eventId}/messages/{messageId}', name: 'guest_messages_show', methods: ['GET'], requirements: ['messageId' => '[0-9a-f-]{36}'])]
    #[InEvent(Permission::MessagesRead)]
    public function show(string $eventId, string $messageId): JsonResponse
    {
        $event = $this->event($eventId);
        $message = $this->guestMessageRepository->findOneOn($event, $messageId) ?? throw ApiException::notFound('access.not_found');

        return new JsonResponse(['message' => $this->guestMessageSerialiser->details($message, $this->managesGuests($event))]);
    }

    /** The send check's figures, from the same rule as Send: everyone it goes to on their page, how many email tells, and who it can't, by name with why. */
    #[Route('/api/events/{eventId}/messages/check', name: 'guest_messages_check', methods: ['POST'])]
    #[InEvent(Permission::MessagesManage)]
    public function check(Request $request, string $eventId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'audience' => self::audienceType(),
            'guestIds' => Type\optional(Type\vec(Type\string())),
        ]));
        $plan = $this->guestMessageSender->check($this->event($eventId), $body['audience'], $body['guestIds'] ?? []);

        return new JsonResponse([
            'people' => Iter\count($plan->deliveries),
            'toldByEmail' => $plan->toldByEmail(),
            'cantBeTold' => Vec\map($plan->cantBeTold(), static fn (PlannedDelivery $delivery): array => [
                'guestId' => $delivery->recipientId->toRfc4122(),
                'name' => $delivery->name,
                'reason' => $delivery->notSent?->value,
            ]),
        ]);
    }

    /** 202 with how many email deliveries were queued and how many can't be told, even when none can: the message is on their pages all the same. */
    #[Route('/api/events/{eventId}/messages', name: 'guest_messages_send', methods: ['POST'])]
    #[InEvent(Permission::MessagesManage)]
    public function send(Request $request, string $eventId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'audience' => self::audienceType(),
            'guestIds' => Type\optional(Type\vec(Type\string())),
            'subject' => Type\optional(Type\nullable(Type\string())),
            'message' => Type\string(),
        ]));
        $sent = $this->guestMessageSender->send($this->event($eventId), $this->user(), $body['audience'], $body['guestIds'] ?? [], $body['subject'] ?? null, $body['message']);
        $queued = $sent->plan->toldByEmail();

        return new JsonResponse([
            'id' => $sent->id->toRfc4122(),
            'queued' => ['email' => $queued],
            'notSent' => ['email' => Iter\count($sent->plan->deliveries) - $queued],
        ], Response::HTTP_ACCEPTED);
    }

    /** @return Type\TypeInterface<string> */
    private static function audienceType(): Type\TypeInterface
    {
        return Type\union(Type\literal_scalar(GuestMessage::ALL), Type\literal_scalar(GuestMessage::CHOSEN));
    }

    private function managesGuests(Event $event): bool
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
