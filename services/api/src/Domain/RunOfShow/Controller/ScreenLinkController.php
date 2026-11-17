<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Controller;

use App\Domain\RunOfShow\Screen\ScreenLinks;
use App\Entity\Event;
use App\Entity\ScreenLink;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\ScreenLinkRepository;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** Show on a screen on the Schedule page (sc-3897): a room screen link for each place, and replacing one. Only those who manage the run of show make and end them. */
final readonly class ScreenLinkController
{
    public function __construct(
        private EventRepository $eventRepository,
        private ScreenLinks $screenLinks,
        private ScreenLinkRepository $screenLinkRepository,
    ) {
    }

    /** `place` is null for Main; each client puts its own address in front of `token`. */
    #[Route('/api/events/{eventId}/screen-links', name: 'screen_links_list', methods: ['GET'])]
    #[InEvent(Permission::RunOfShowManage)]
    public function list(string $eventId): JsonResponse
    {
        return $this->links($this->event($eventId));
    }

    /** Refused 404 for a place with no item on the schedule. */
    #[Route('/api/events/{eventId}/screen-links/replace', name: 'screen_links_replace', methods: ['POST'])]
    #[InEvent(Permission::RunOfShowManage)]
    public function replace(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape(['place' => Type\nullable(Type\string())]));
        $this->screenLinks->replace($event, $body['place'] ?? '');

        return $this->links($event);
    }

    private function links(Event $event): JsonResponse
    {
        $zone = new DateTimeZone($event->getTimeZone());
        $replaced = $this->screenLinkRepository->findLastReplacedOn($event);

        return new JsonResponse(['links' => Vec\map(
            $this->screenLinks->of($event),
            fn (ScreenLink $link): array => [
                'place' => '' === $link->getPlace() ? null : $link->getPlace(),
                'token' => $this->screenLinks->tokenOf($link),
                'replacedAt' => isset($replaced[$link->getPlace()]) ? self::zoned($replaced[$link->getPlace()], $zone) : null,
            ],
        )]);
    }

    private static function zoned(DateTimeImmutable $moment, DateTimeZone $zone): string
    {
        return $moment->setTimezone($zone)->format(\DATE_ATOM);
    }

    private function event(string $id): Event
    {
        return $this->eventRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }
}
