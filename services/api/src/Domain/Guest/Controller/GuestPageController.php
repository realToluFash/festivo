<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Event\Http\EventSerialiser;
use App\Domain\Guest\Link\InvitationLinks;
use App\Entity\Guest;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

/** The token is a credential, so it travels in the body, never the URL, where request logs would keep it. */
final readonly class GuestPageController
{
    public function __construct(
        private InvitationLinks $invitationLinks,
        private EventSerialiser $eventSerialiser,
        private RateLimiterFactoryInterface $guestLinkWrongPersonLimiter,
    ) {
    }

    /** Records nothing: mail scanners and link previews open every link first (RFC 9110 §9.2.1). */
    #[Route('/api/guest-links/page', name: 'guest_links_page', methods: ['POST'])]
    #[PublicAccess]
    public function page(Request $request): JsonResponse
    {
        $guest = $this->guest($request);
        $event = $guest->getEvent();

        return new JsonResponse([
            'guest' => ['fullName' => $guest->getFullName()],
            'event' => [
                'id' => $event->getId()->toRfc4122(),
                'name' => $event->getName(),
                'type' => $event->getType()->value,
                'cover' => $this->eventSerialiser->coverOf($event),
                'hosts' => $event->getHosts(),
            ],
        ], headers: ['Cache-Control' => 'no-store']);
    }

    /** "Not {full name}? Tell us": flags the guest for the hosts and changes nothing else. Refused 429 after 5 an hour on one link, so a replaced link's budget never reaches the new one. */
    #[Route('/api/guest-links/wrong-person', name: 'guest_links_wrong_person', methods: ['POST'])]
    #[PublicAccess]
    public function wrongPerson(Request $request): Response
    {
        $token = $this->token($request);
        $guest = $this->invitationLinks->guestFor($token) ?? throw ApiException::notFound('access.not_found');
        $limit = $this->guestLinkWrongPersonLimiter->create(\hash('sha256', $token))->consume();

        if (!$limit->isAccepted()) {
            throw ApiException::tooManyAttempts('limits.tries', $limit->getRetryAfter());
        }

        $this->invitationLinks->flag($guest);

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    private function guest(Request $request): Guest
    {
        return $this->invitationLinks->guestFor($this->token($request)) ?? throw ApiException::notFound('access.not_found');
    }

    private function token(Request $request): string
    {
        return Input::body($request, Type\shape(['token' => Type\string()]))['token'];
    }
}
