<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Event\CalendarFeed\FeedLinkIssuer;
use App\Domain\Event\EventVenue;
use App\Domain\Event\Http\EventSerialiser;
use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\GuestRules;
use App\Domain\Guest\Http\GuestSerialiser;
use App\Domain\Guest\Link\InvitationLinks;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Guest\Reply\GuestAnswers;
use App\Entity\Guest;
use App\Enum\ErrorCode;
use App\Enum\GuestPagePhase;
use App\Enum\GuestReply;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Locale\SupportedLocales;
use App\Repository\GuestRepository;
use DateTimeZone;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
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
        private GuestRules $guestRules,
        private GuestNeedsRecord $guestNeedsRecord,
        private GuestRepository $guestRepository,
        private TranslatorInterface $translator,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** Records nothing: mail scanners and link previews open every link first (RFC 9110 §9.2.1). */
    #[Route('/api/guest-links/page', name: 'guest_links_page', methods: ['POST'])]
    #[PublicAccess]
    public function page(Request $request): JsonResponse
    {
        return $this->answered($this->guest($request));
    }

    /** Refused 422 for an answer the page does not offer, a name beyond the places (sc-3779) or a need it does not know (sc-3778), 409 `event_paused` or `event_concluded` by the event's phase, and 409 `replies_closed` from the start; answers the page as it now stands. */
    #[Route('/api/guest-links/reply', name: 'guest_links_reply', methods: ['POST'])]
    #[PublicAccess]
    public function reply(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'token' => Type\string(),
            'answer' => Type\string(),
            'companions' => Type\optional(Type\vec(Type\shape([
                'id' => Type\optional(Type\nullable(Type\string())),
                'fullName' => Type\string(),
                'coming' => Type\bool(),
                'needs' => Type\optional(Type\nullable(self::needsShape())),
            ]))),
            'needs' => Type\optional(Type\nullable(self::needsShape())),
        ]));
        $guest = $this->invitationLinks->guestFor($body['token']) ?? throw ApiException::notFound('access.not_found');
        $answer = GuestReply::tryFrom($body['answer']);

        if (null === $answer || GuestReply::NoReply === $answer) {
            throw ApiException::validation([[
                'propertyPath' => 'answer',
                'message' => $this->translator->trans('validation.guest_answer_unknown'),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        $this->guestAnswers->answer($guest, $answer, $this->guestRules->pageReply($body['companions'] ?? [], $body['needs'] ?? null));

        return $this->answered($guest);
    }

    /**
     * sc-3777's needs without the private note, which belongs to the hosts alone.
     *
     * @return Type\TypeInterface<array{allergies?: list<string>, diet?: list<string>, access?: list<string>, otherAllergy?: ?string, otherDiet?: ?string, otherAccess?: ?string}>
     */
    private static function needsShape(): Type\TypeInterface
    {
        return Type\shape([
            'allergies' => Type\optional(Type\vec(Type\string())),
            'diet' => Type\optional(Type\vec(Type\string())),
            'access' => Type\optional(Type\vec(Type\string())),
            'otherAllergy' => Type\optional(Type\nullable(Type\string())),
            'otherDiet' => Type\optional(Type\nullable(Type\string())),
            'otherAccess' => Type\optional(Type\nullable(Type\string())),
        ]);
    }

    private function answered(Guest $guest): JsonResponse
    {
        $event = $guest->getEvent();
        $zone = new DateTimeZone($event->getTimeZone());
        $venue = EventVenue::of($event);
        $reply = $guest->getReply();
        $repliedAt = $guest->getRepliedAt();
        $places = $this->guestRepository->findCompanionsOf($guest);
        $named = Vec\filter($places, static fn (Guest $place): bool => null !== $place->getFullName());
        $needs = $this->guestNeedsRecord->of([$guest, ...$named]);
        $needsOf = static fn (Guest $person): array => GuestSerialiser::needs($person, $needs[$person->getId()->toRfc4122()] ?? GuestNeeds::none(), note: false);

        return new JsonResponse([
            'guest' => [
                'fullName' => $guest->getFullName(),
                'reply' => null === $reply || GuestReply::NoReply === $reply || null === $repliedAt ? null : [
                    'answer' => $reply->value,
                    'at' => $repliedAt->setTimezone($zone)->format(\DATE_ATOM),
                ],
                'needs' => $needsOf($guest),
                'places' => Iter\count($places),
                'companions' => Vec\map(
                    $named,
                    static fn (Guest $companion): array => [
                        'id' => $companion->getId()->toRfc4122(),
                        'fullName' => $companion->getFullName(),
                        'coming' => !$companion->isNotComingByGuest(),
                        'namedByGuest' => $companion->isNamedByGuest(),
                        'needs' => $needsOf($companion),
                    ],
                ),
            ],
            'language' => [
                'chosen' => $guest->getChosenLanguage(),
                'host' => $guest->getLanguage(),
                'organisation' => SupportedLocales::narrow($event->getOrganisation()->getLocale()),
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
            'phase' => $this->guestAnswers->phase($guest)->value,
            'started' => $this->guestAnswers->started($guest),
            'answersOpen' => $this->guestAnswers->open($guest),
            'calendarFeed' => $this->calendarFeed($guest),
        ], headers: ['Cache-Control' => 'no-store']);
    }

    /** The guest's own language menu (sc-3790): kept on the guest, so the link opens in it on any device, and never on an account. Refused 422 for a language Soirely does not offer. */
    #[Route('/api/guest-links/language', name: 'guest_links_language', methods: ['POST'])]
    #[PublicAccess]
    public function language(Request $request): Response
    {
        $body = Input::body($request, Type\shape(['token' => Type\string(), 'language' => Type\string()]));
        $guest = $this->invitationLinks->guestFor($body['token']) ?? throw ApiException::notFound('access.not_found');

        if (!Iter\contains(SupportedLocales::ALL, $body['language'])) {
            throw ApiException::validation([[
                'propertyPath' => 'language',
                'message' => $this->translator->trans('validation.guest_language_unknown'),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        $guest->choseLanguage($body['language']);
        $this->entityManager->flush();

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /** Add to calendar's feed, the path on this API, as each client puts its own API address in front: only for Coming while the event is Live (sc-3627). */
    private function calendarFeed(Guest $guest): ?string
    {
        $token = $guest->getLinkToken();

        return null === $token || GuestReply::Coming !== $guest->getReply() || GuestPagePhase::Live !== $this->guestAnswers->phase($guest)
            ? null
            : GuestCalendarFeedController::PATH . $token . FeedLinkIssuer::SUFFIX;
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
