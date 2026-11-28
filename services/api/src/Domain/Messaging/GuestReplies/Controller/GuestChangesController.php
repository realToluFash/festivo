<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestReplies\Controller;

use App\Domain\Messaging\GuestReplies\GuestReplyLog;
use App\Domain\Messaging\GuestReplies\Model\GuestChangeRow;
use App\Domain\Messaging\GuestReplies\Model\GuestReplyTally;
use App\Domain\Messaging\NotificationReadMarker;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\NotificationItemRepository;
use DateTimeImmutable;
use Exception;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** The guest list's Changed since you looked (sc-4331, AC 2 to 4): reading it by the time in the address marks nothing; choosing it is a look. */
final readonly class GuestChangesController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private GuestReplyLog $guestReplyLog,
        private NotificationItemRepository $notificationItemRepository,
        private NotificationReadMarker $notificationReadMarker,
        private ClockInterface $clock,
    ) {
    }

    /** With `since`, the rows from that time (`all` for every change), as a reload or a shared link asks; without it, from the caller's last look, as the menu's row counts them. */
    #[Route('/api/events/{eventId}/guests/changes', name: 'guest_changes', methods: ['GET'], priority: 1)]
    #[InEvent(Permission::GuestsRead)]
    public function list(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $asked = Input::query($request, Type\shape(['since' => Type\optional(Type\string())], true))['since'] ?? null;
        $since = null === $asked ? $this->guestReplyLog->lookedAt($this->user()->getId(), $eventId) : self::since($asked);

        return $this->answer($event, $since);
    }

    /** Choosing it from the menu: the rows from the caller's last look, which this then moves to now, marking the event's bell item read (AC 3). */
    #[Route('/api/events/{eventId}/guests/changes/look', name: 'guest_changes_look', methods: ['POST'], priority: 1)]
    #[InEvent(Permission::GuestsRead)]
    public function look(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $user = $this->user();
        $since = $this->guestReplyLog->lookedAt($user->getId(), $eventId);
        $response = $this->answer($event, $since);
        $item = $this->notificationItemRepository->findUnreadInThread($user, GuestReplyLog::thread($eventId));

        if (null === $item) {
            $this->guestReplyLog->look($user->getId(), $eventId, $this->clock->now());
        } else {
            $this->notificationReadMarker->markRead($user, $item);
        }

        return $response;
    }

    private function answer(Event $event, ?DateTimeImmutable $since): JsonResponse
    {
        $tally = $this->guestReplyLog->after($event->getId()->toRfc4122(), $since);

        return new JsonResponse([
            'since' => null === $since ? GuestReplyLog::NEVER : $since->format(\DATE_ATOM),
            'rows' => self::rows($tally),
        ]);
    }

    /** @return list<array{guestId: string, kind: string, at: string}> newest first */
    private static function rows(GuestReplyTally $tally): array
    {
        return Vec\map($tally->rows, static fn (GuestChangeRow $row): array => [
            'guestId' => $row->guestId,
            'kind' => $row->kind->value,
            'at' => $row->at->format(\DATE_ATOM),
        ]);
    }

    /** `all`, or anything that is not a time, counts every change: an address edited by hand shows more, never less. */
    private static function since(string $asked): ?DateTimeImmutable
    {
        try {
            return GuestReplyLog::NEVER === $asked ? null : new DateTimeImmutable($asked);
        } catch (Exception) {
            return null;
        }
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
