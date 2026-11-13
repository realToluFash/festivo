<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Event\EventVenue;
use App\Domain\Event\Http\EventSerialiser;
use App\Domain\Guest\Link\InvitationLinks;
use App\Domain\Guest\Reply\GuestAnswers;
use App\Entity\Guest;
use App\Enum\ErrorCode;
use App\Enum\GuestReply;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\GuestRepository;
use DateTimeZone;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The token is a credential, so it travels in the body, never the URL, where request logs would keep it. */
final readonly class GuestPageController
{
    public function __construct(
        private InvitationLinks $invitationLinks,
        private EventSerialiser $eventSerialiser,
        private RateLimiterFactoryInterface $guestLinkWrongPersonLimiter,
        private GuestAnswers $guestAnswers,
        private GuestRepository $guestRepository,
        private TranslatorInterface $translator,
    ) {
    }

    /** Records nothing: mail scanners and link previews open every link first (RFC 9110 §9.2.1). */
    #[Route('/api/guest-links/page', name: 'guest_links_page', methods: ['POST'])]
    #[PublicAccess]
    public function page(Request $request): JsonResponse
    {
        return $this->answered($this->guest($request));
    }

    /** Refused 422 for an answer the page does not offer and 409 `replies_closed` from the start; answers the page as it now stands. */
    #[Route('/api/guest-links/reply', name: 'guest_links_reply', methods: ['POST'])]
    #[PublicAccess]
    public function reply(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['token' => Type\string(), 'answer' => Type\string()]));
        $guest = $this->invitationLinks->guestFor($body['token']) ?? throw ApiException::notFound('access.not_found');
        $answer = GuestReply::tryFrom($body['answer']);

        if (null === $answer || GuestReply::NoReply === $answer) {
            throw ApiException::validation([[
                'propertyPath' => 'answer',
                'message' => $this->translator->trans('validation.guest_answer_unknown'),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        $this->guestAnswers->answer($guest, $answer);

        return $this->answered($guest);
    }

    private function answered(Guest $guest): JsonResponse
    {
        $event = $guest->getEvent();
        $zone = new DateTimeZone($event->getTimeZone());
        $venue = EventVenue::of($event);
        $reply = $guest->getReply();
        $repliedAt = $guest->getRepliedAt();

        return new JsonResponse([
            'guest' => [
                'fullName' => $guest->getFullName(),
                'reply' => null === $reply || GuestReply::NoReply === $reply || null === $repliedAt ? null : [
                    'answer' => $reply->value,
                    'at' => $repliedAt->setTimezone($zone)->format(\DATE_ATOM),
                ],
                'companions' => $this->guestRepository->countCompanions($guest),
            ],
            'event' => [
                'id' => $event->getId()->toRfc4122(),
                'name' => $event->getName(),
                'type' => $event->getType()->value,
                'cover' => $this->eventSerialiser->coverOf($event),
                'hosts' => $event->getHosts(),
                'startsAt' => $event->getStartsAt()->format(\DATE_ATOM),
                'timeZone' => $event->getTimeZone(),
                'venue' => null === $venue ? null : ['name' => $venue->name, 'address' => $venue->address?->formatted],
            ],
            'answersOpen' => $this->guestAnswers->open($guest),
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
