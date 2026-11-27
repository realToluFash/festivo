<?php

declare(strict_types=1);

namespace App\Domain\Staff\Controller;

use App\Domain\Staff\Http\StaffSerialiser;
use App\Domain\Staff\Link\MyNight;
use App\Domain\Staff\Link\StaffLinkGrants;
use App\Domain\Staff\Link\StaffLinks;
use App\Domain\Staff\Link\StaffLinkSignIn;
use App\Domain\Staff\Link\StaffLinkWindow;
use App\Domain\User\CallerSession;
use App\Domain\User\Http\SignInResponse;
use App\Domain\User\PhoneSignIn\PhoneHint;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\Authenticated;
use App\Http\Access\Policy\InEvent;
use App\Http\Access\Policy\PublicAccess;
use App\Http\CodeField;
use App\Http\Exception\ApiException;
use App\Http\Input;
use DateTimeZone;
use Psl\Iter;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** Each person's own link (sc-3912): given out from the roster, and opened by its token on any device with no sign-in. The token travels in the body, never the URL, where request logs would keep it. */
final readonly class StaffLinkController
{
    public function __construct(
        private Security $security,
        private StaffLinks $staffLinks,
        private StaffSerialiser $staffSerialiser,
        private RateLimiterFactoryInterface $staffLinkLimiter,
        private StaffLinkSignIn $staffLinkSignIn,
        private SignInResponse $signInResponse,
        private CodeField $codeField,
        private CallerSession $callerSession,
        private StaffLinkGrants $staffLinkGrants,
        private MyNight $myNight,
    ) {
    }

    /** Answers the link with its plain token once, which is never logged or kept; refused 409 `conflict` with no mobile number. */
    #[Route('/api/events/{eventId}/staff/{staffId}/link', name: 'staff_link_deliver', methods: ['POST'])]
    #[InEvent(Permission::StaffManage)]
    public function deliver(#[InThisEvent('staffId')] StaffMember $entry): JsonResponse
    {
        $url = $this->staffLinks->deliver($entry, $this->user());

        return new JsonResponse(['url' => $url, 'staff' => $this->staffSerialiser->entry($entry)]);
    }

    #[Route('/api/events/{eventId}/staff/{staffId}/link/sent', name: 'staff_link_mark_sent', methods: ['POST'])]
    #[InEvent(Permission::StaffManage)]
    public function markSent(#[InThisEvent('staffId')] StaffMember $entry): JsonResponse
    {
        $this->staffLinks->markSent($entry, $this->user());

        return new JsonResponse(['staff' => $this->staffSerialiser->entry($entry)]);
    }

    #[Route('/api/events/{eventId}/staff/{staffId}/link/replace', name: 'staff_link_replace', methods: ['POST'])]
    #[InEvent(Permission::StaffManage)]
    public function replace(#[InThisEvent('staffId')] StaffMember $entry): JsonResponse
    {
        $this->staffLinks->replace($entry, $this->user());

        return new JsonResponse(['staff' => $this->staffSerialiser->entry($entry)]);
    }

    /** Where the link stands, and nothing about the person or the event beyond its time; records nothing. Unknown, replaced and removed are one 404. */
    #[Route('/api/staff-links/look', name: 'staff_links_look', methods: ['POST'])]
    #[PublicAccess]
    public function look(Request $request): JsonResponse
    {
        $entry = $this->entry($request);

        return new JsonResponse($this->shown($entry));
    }

    /** Sends the code to the entry's own number (sc-4235); answers the same whatever account the number is on. */
    #[Route('/api/staff-links/sign-in/send', name: 'staff_links_sign_in_send', methods: ['POST'])]
    #[PublicAccess]
    public function send(Request $request): JsonResponse
    {
        $handle = $this->staffLinkSignIn->send($this->entry($request), $request);

        return new JsonResponse(['handle' => $handle, 'cooldownSeconds' => VerificationChallenge::RESEND_COOLDOWN_SECONDS]);
    }

    /** The code makes or signs into the number's account and links the entry to it; with two-factor on, a 202 challenge first, as sign-in's. */
    #[Route('/api/staff-links/sign-in', name: 'staff_links_sign_in', methods: ['POST'])]
    #[PublicAccess]
    public function signIn(Request $request): JsonResponse
    {
        $entry = $this->entry($request);
        $body = Input::body($request, Type\shape([
            'token' => Type\string(),
            'handle' => Type\string(),
            'code' => Type\optional(Type\mixed()),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));
        $delivery = $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body;
        $signedIn = $this->staffLinkSignIn->signIn($entry, $body['handle'], $this->codeField->required($body, 'code', CodeField::FROM_TEXT), $request, RefreshTokenDelivery::Cookie === $delivery);

        return $this->signInResponse->for($signedIn['admission'], $signedIn['user'], $delivery, $request);
    }

    /** The person's own night (sc-3915), to the entry's own account inside the link's window; every other caller is answered 404, as for a link that does not exist. */
    #[Route('/api/staff-links/night', name: 'staff_links_night', methods: ['POST'])]
    #[PublicAccess]
    public function night(Request $request): JsonResponse
    {
        $entry = $this->entry($request);
        $reader = $this->security->getUser();
        $window = $this->staffLinks->window($entry);

        if (!$reader instanceof User || true !== $entry->getAccount()?->getId()->equals($reader->getId())) {
            throw ApiException::notFound('access.not_found');
        }

        return match (true) {
            $window->open && null !== $window->until => new JsonResponse($this->myNight->of($entry, $window->until)),
            null !== $window->clockUntil => new JsonResponse($this->myNight->pastAccess($entry, $window->clockUntil)),
            default => throw ApiException::notFound('access.not_found'),
        };
    }

    /** The same night in the app, for an account on the event's roster through its link (sc-3906) or a join code's shift (sc-234), and its clock card alone past access (sc-234); 404 for anybody else, organisers included. */
    #[Route('/api/events/{eventId}/my-night', name: 'staff_my_night', methods: ['GET'])]
    #[Authenticated]
    public function mine(string $eventId): JsonResponse
    {
        $event = Uuid::isValid($eventId) ? Uuid::fromString($eventId) : null;
        $grant = null === $event ? null : Iter\first($this->staffLinkGrants->live($this->user(), $event));

        if (null !== $grant) {
            return new JsonResponse($this->myNight->of($grant['entry'], $grant['until']));
        }

        $byCode = null === $event ? null : Iter\first($this->staffLinkGrants->byCode($this->user(), $event));

        if (null !== $byCode) {
            return new JsonResponse($this->myNight->of($byCode['entry'], $byCode['until'], $byCode['level']));
        }

        $clockOnly = null === $event ? null : Iter\first($this->staffLinkGrants->clockOnly($this->user(), $event));

        return null === $clockOnly ? throw ApiException::notFound('access.not_found') : new JsonResponse($this->myNight->pastAccess($clockOnly['entry'], $clockOnly['until']));
    }

    /** Sent by the page once it is visible, so a preview fetch records nothing; answers as `look` does. */
    #[Route('/api/staff-links/opened', name: 'staff_links_opened', methods: ['POST'])]
    #[PublicAccess]
    public function opened(Request $request): JsonResponse
    {
        $entry = $this->entry($request);
        $this->staffLinks->opened($entry);

        return new JsonResponse($this->shown($entry));
    }

    /** @return array<string, mixed> open, nothing past the event, the job and the masked number before the code (sc-4235); only another signed-in account is told whose link it is, and only the entry's own when its browser session ends */
    private function shown(StaffMember $entry): array
    {
        $state = self::state($this->staffLinks->window($entry), $entry);

        if ('open' !== $state['state']) {
            return $state;
        }

        $reader = $this->security->getUser();
        $mobile = $entry->getMobile();
        $mine = $reader instanceof User && true === $entry->getAccount()?->getId()->equals($reader->getId());

        return $state + [
            'event' => ['name' => $entry->getEvent()->getName()],
            'job' => true === $state['pastAccess'] ? null : $entry->getJob()?->getName(),
            'mobile' => null === $mobile ? null : PhoneHint::ofNumber($mobile),
            'reader' => match (true) {
                !$reader instanceof User => null,
                $mine => 'yours',
                default => 'other',
            },
            'name' => $reader instanceof User && !$mine ? $entry->getFullName() : null,
        ] + ($reader instanceof User && $mine ? ['signedOutAt' => $this->callerSession->endsAt($reader)?->setTimezone(new DateTimeZone($entry->getEvent()->getTimeZone()))->format(\DATE_ATOM), 'timeZone' => $entry->getEvent()->getTimeZone()] : []);
    }

    /** @return array<string, string|bool> */
    private static function state(StaffLinkWindow $window, StaffMember $entry): array
    {
        if ($window->open) {
            return ['state' => 'open', 'pastAccess' => false];
        }

        if (null !== $window->clockUntil) {
            return ['state' => 'open', 'pastAccess' => true];
        }

        if ($window->ended) {
            return ['state' => 'ended'];
        }

        if (null === $window->from) {
            return ['state' => 'not_yet'];
        }

        return ['state' => 'not_yet', 'from' => $window->from->setTimezone(new DateTimeZone($entry->getEvent()->getTimeZone()))->format(\DATE_ATOM)];
    }

    private function entry(Request $request): StaffMember
    {
        $limit = $this->staffLinkLimiter->create($request->getClientIp() ?? 'anonymous')->consume();

        if (!$limit->isAccepted()) {
            throw ApiException::tooManyAttempts('limits.staff_links', $limit->getRetryAfter());
        }

        $token = Input::body($request, Type\shape(['token' => Type\string()], true))['token'];

        return $this->staffLinks->find($token) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
