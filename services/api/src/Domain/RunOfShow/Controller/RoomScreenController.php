<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Controller;

use App\Domain\RunOfShow\Screen\RoomScreen;
use App\Domain\RunOfShow\Screen\ScreenLinks;
use App\Entity\ScreenLink;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Realtime\SubscriberTokenIssuer;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** The room screen (sc-3897), on any browser with no sign-in. The token is a credential, so it travels in the body, never the URL, where request logs would keep it. */
final readonly class RoomScreenController
{
    public function __construct(
        private ScreenLinks $screenLinks,
        private RoomScreen $roomScreen,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
    ) {
    }

    /** A replaced link answers `replaced` and nothing about the event; one never issued, or a deleted event's, is 404. */
    #[Route('/api/screen-links/screen', name: 'screen_links_screen', methods: ['POST'])]
    #[PublicAccess]
    public function screen(Request $request): JsonResponse
    {
        return new JsonResponse($this->roomScreen->of($this->link($request)));
    }

    /** A hub token for the event's bare signal to ask again; a replaced link gets none, so it hears no more of the event. */
    #[Route('/api/screen-links/subscriptions', name: 'screen_links_subscribe', methods: ['POST'])]
    #[PublicAccess]
    public function subscribe(Request $request): JsonResponse
    {
        $link = $this->link($request);

        if (null !== $link->getReplacedAt()) {
            throw ApiException::notFound('access.not_found');
        }

        $issued = $this->subscriberTokenIssuer->issueForEventScreens($link->getEvent()->getId());

        return new JsonResponse([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->format(\DATE_ATOM),
        ]);
    }

    private function link(Request $request): ScreenLink
    {
        $token = Input::body($request, Type\shape(['token' => Type\string()]))['token'];

        return $this->screenLinks->find($token) ?? throw ApiException::notFound('access.not_found');
    }
}
