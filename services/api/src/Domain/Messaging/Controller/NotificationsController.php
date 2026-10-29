<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Controller;

use App\Domain\Messaging\Http\NotificationItemSerialiser;
use App\Domain\Messaging\NotificationItemPruner;
use App\Domain\Messaging\NotificationReadMarker;
use App\Entity\NotificationItem;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\NotificationItemRepository;
use DateTimeImmutable;
use Psl\Iter;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** The bell (sc-3980): a member's own items from the last 90 days, newest first, and their read state. */
#[Authenticated]
final readonly class NotificationsController
{
    public const int PAGE = 30;

    public function __construct(
        private Security $security,
        private NotificationItemRepository $notificationItemRepository,
        private NotificationItemSerialiser $notificationItemSerialiser,
        private NotificationReadMarker $notificationReadMarker,
        private NotificationItemPruner $notificationItemPruner,
    ) {
    }

    /** `after` is the previous page's `next`, the id of its last item; `next` is null on the last page. */
    #[Route('/api/notifications', name: 'notifications_feed', methods: ['GET'])]
    public function feed(Request $request): JsonResponse
    {
        $user = $this->user();
        $after = Input::query($request, Type\shape(['after' => Type\optional(Type\string())]))['after'] ?? null;
        $items = $this->notificationItemRepository->findFeedFor($user, $this->since(), null === $after ? null : $this->item($user, $after), self::PAGE);
        $last = Iter\last($items);

        return new JsonResponse([
            'items' => $this->notificationItemSerialiser->items($user, $items),
            'unreadCount' => $this->notificationItemRepository->countUnreadFor($user, $this->since()),
            'next' => self::PAGE === Iter\count($items) && null !== $last ? $last->getId()->toRfc4122() : null,
        ]);
    }

    #[Route('/api/notifications/{id}/read', name: 'notifications_read', methods: ['POST'])]
    public function read(string $id): JsonResponse
    {
        $user = $this->user();
        $item = $this->item($user, $id);
        $unread = $this->notificationReadMarker->markRead($user, $item);

        return new JsonResponse([
            'item' => $this->notificationItemSerialiser->items($user, [$item])[0],
            'unreadCount' => $unread,
        ]);
    }

    #[Route('/api/notifications/read-all', name: 'notifications_read_all', methods: ['POST'])]
    public function readAll(): JsonResponse
    {
        return new JsonResponse(['unreadCount' => $this->notificationReadMarker->markAllRead($this->user())]);
    }

    private function since(): DateTimeImmutable
    {
        return $this->notificationItemPruner->keptSince();
    }

    /** Somebody else's item is not found, the same as one that never existed. */
    private function item(User $user, string $id): NotificationItem
    {
        return (Uuid::isValid($id) ? $this->notificationItemRepository->findOneForUser($user, Uuid::fromString($id)) : null)
            ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
