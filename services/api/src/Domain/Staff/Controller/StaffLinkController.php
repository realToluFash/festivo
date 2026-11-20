<?php

declare(strict_types=1);

namespace App\Domain\Staff\Controller;

use App\Domain\Staff\Http\StaffSerialiser;
use App\Domain\Staff\Link\StaffLinks;
use App\Domain\Staff\Link\StaffLinkWindow;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use DateTimeZone;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

/** Each person's own link (sc-3912): given out from the roster, and opened by its token on any device with no sign-in. The token travels in the body, never the URL, where request logs would keep it. */
final readonly class StaffLinkController
{
    public function __construct(
        private Security $security,
        private StaffLinks $staffLinks,
        private StaffSerialiser $staffSerialiser,
        private RateLimiterFactoryInterface $staffLinkLimiter,
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

        return new JsonResponse(self::state($this->staffLinks->window($entry), $entry));
    }

    /** Sent by the page once it is visible, so a preview fetch records nothing; answers as `look` does. */
    #[Route('/api/staff-links/opened', name: 'staff_links_opened', methods: ['POST'])]
    #[PublicAccess]
    public function opened(Request $request): JsonResponse
    {
        $entry = $this->entry($request);
        $this->staffLinks->opened($entry);

        return new JsonResponse(self::state($this->staffLinks->window($entry), $entry));
    }

    /** @return array<string, string> */
    private static function state(StaffLinkWindow $window, StaffMember $entry): array
    {
        if ($window->open) {
            return ['state' => 'open'];
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

        $token = Input::body($request, Type\shape(['token' => Type\string()]))['token'];

        return $this->staffLinks->find($token) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
