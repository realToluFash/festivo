<?php

declare(strict_types=1);

namespace App\Domain\Menu\Controller;

use App\Domain\Menu\Pick\HostPicks;
use App\Domain\Menu\Pick\PicksFigures;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** See picks (sc-3909): menu.read sees the figures, with guests.read their names; guests.manage chooses for a guest, before the close and after it. */
final readonly class MenuPicksController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private PicksFigures $picksFigures,
        private HostPicks $hostPicks,
        private MembershipDirectoryInterface $membershipDirectory,
    ) {
    }

    #[Route('/api/events/{eventId}/menu/picks', name: 'menu_picks_show', methods: ['GET'])]
    #[InEvent(Permission::MenuRead)]
    public function show(string $eventId): JsonResponse
    {
        return $this->picks($this->event($eventId));
    }

    #[Route('/api/events/{eventId}/menu/picks/people/{guestId}/courses/{courseId}', name: 'menu_picks_choose_for', methods: ['PUT'])]
    #[InEvent(Permission::MenuRead)]
    public function chooseFor(Request $request, string $eventId, string $guestId, string $courseId): JsonResponse
    {
        $event = $this->event($eventId);
        $this->requireManage($event);
        $this->hostPicks->chooseFor($event, $guestId, $courseId, Input::body($request, HostPicks::sent()), $this->user());

        return $this->picks($event);
    }

    #[Route('/api/events/{eventId}/menu/picks/variants/{variantId}', name: 'menu_picks_give_variant', methods: ['PUT'])]
    #[InEvent(Permission::MenuRead)]
    public function giveVariant(Request $request, string $eventId, string $variantId): JsonResponse
    {
        $event = $this->event($eventId);
        $this->requireManage($event);
        $sent = Input::body($request, Type\shape(['people' => Type\vec(Type\string()), 'anyway' => Type\optional(Type\bool())]));
        $this->hostPicks->giveVariant($event, $variantId, $sent['people'], $sent['anyway'] ?? false, $this->user());

        return $this->picks($event);
    }

    private function picks(Event $event): JsonResponse
    {
        return new JsonResponse(['picks' => [
            ...$this->picksFigures->of($event, $this->holds($event, Permission::GuestsRead)),
            'canChoose' => $this->holds($event, Permission::GuestsManage) && $this->holds($event, Permission::GuestsRead),
        ]]);
    }

    private function requireManage(Event $event): void
    {
        if (!$this->holds($event, Permission::GuestsManage)) {
            throw ApiException::permissionRequired(Permission::GuestsManage);
        }
    }

    private function holds(Event $event, Permission $permission): bool
    {
        return true === $this->membershipDirectory->grantsOnEvent($this->user(), $event->getOrganisation()->getId(), $event->getId())?->holds($permission);
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
