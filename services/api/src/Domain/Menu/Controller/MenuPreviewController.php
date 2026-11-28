<?php

declare(strict_types=1);

namespace App\Domain\Menu\Controller;

use App\Domain\Guest\Http\GuestPageEvent;
use App\Domain\Menu\Pick\GuestMenu;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\GuestPagePhase;
use App\Enum\NeedKind;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Locale\SupportedLocales;
use App\Repository\EventRepository;
use Psl\Dict;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/** Preview as guest (sc-3907): the guest page's meal step as a guest is offered it, for the signed-in member alone, with no allergies, no companions and nothing stored. It reads no guest. */
final readonly class MenuPreviewController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private GuestPageEvent $guestPageEvent,
        private GuestMenu $guestMenu,
        private ClockInterface $clock,
    ) {
    }

    #[Route('/api/events/{eventId}/menu/preview', name: 'menu_preview', methods: ['GET'])]
    #[InEvent(Permission::MenuRead)]
    public function show(string $eventId): JsonResponse
    {
        $user = $this->security->getUser();

        if (!$user instanceof User) {
            throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
        }

        $event = $this->eventRepository->find($eventId) ?? throw ApiException::notFound('access.not_found');
        $now = $this->clock->now();
        $phase = GuestPagePhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $event->getEndedAt(), $now);
        $started = $now >= $event->getStartsAt();

        return new JsonResponse([
            'guest' => [
                'fullName' => $user->getName(),
                'reply' => null,
                'needs' => [
                    ...Dict\from_entries(Vec\map(NeedKind::cases(), static fn (NeedKind $kind): array => [$kind->field(), []])),
                    ...Dict\from_entries(Vec\map(NeedKind::cases(), static fn (NeedKind $kind): array => [$kind->otherField(), null])),
                    'changed' => null,
                ],
                'places' => 0,
                'companions' => [],
                'unnamed' => [],
            ],
            'language' => [
                'chosen' => null,
                'host' => null,
                'organisation' => SupportedLocales::narrow($event->getOrganisation()->getLocale()),
            ],
            'event' => $this->guestPageEvent->of($event, $phase),
            'phase' => $phase->value,
            'started' => $started,
            'answersOpen' => GuestPagePhase::Live === $phase && !$started,
            'answersClosedOn' => null,
            'calendarFeed' => null,
            'programme' => [],
            'meals' => [
                'you' => 'preview',
                'courses' => $this->guestMenu->menu($event),
                'answers' => [],
            ],
        ], headers: ['Cache-Control' => 'no-store']);
    }
}
