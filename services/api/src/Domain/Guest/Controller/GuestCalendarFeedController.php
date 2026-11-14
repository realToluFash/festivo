<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Event\CalendarFeed\CalendarFeedResponse;
use App\Domain\Event\CalendarFeed\CalendarFeedWriter;
use App\Domain\Event\CalendarFeed\FeedLinkIssuer;
use App\Domain\Guest\Calendar\GuestCalendarWriter;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Repository\GuestRepository;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

/**
 * The calendar a guest subscribes to from their own page (sc-3627). Its secret is their invitation token, so replacing the link (sc-1526) ends it; a called-off or deleted event stays in it as cancelled for the restore window, then answers the same 404 as a link that never existed.
 */
#[PublicAccess]
final readonly class GuestCalendarFeedController
{
    public const string PATH = '/api/guest-calendars/';

    public function __construct(
        private GuestRepository $guestRepository,
        private GuestCalendarWriter $guestCalendarWriter,
        private RateLimiterFactoryInterface $calendarFeedTokenLimiter,
        private ClockInterface $clock,
    ) {
    }

    // @mago-expect lint:no-literal-password the pattern of the link's token, not a token
    #[Route(self::PATH . '{token}' . FeedLinkIssuer::SUFFIX, name: 'guest_calendar_feed', requirements: ['token' => '[A-Za-z0-9_-]{43}'], methods: ['GET'])]
    public function fetch(Request $request, #[SensitiveParameter] string $token): Response
    {
        $limit = $this->calendarFeedTokenLimiter->create('guest:' . FeedLinkIssuer::hash($token))->consume();

        if (!$limit->isAccepted()) {
            throw ApiException::tooManyAttempts('limits.calendar_feed', $limit->getRetryAfter());
        }

        $guest = $this->guestRepository->findOneForCalendar($token) ?? throw ApiException::notFound('access.not_found');
        $status = CalendarFeedWriter::statusOf($guest->getEvent(), $this->clock->now()) ?? throw ApiException::notFound('access.not_found');

        return CalendarFeedResponse::of($request, $this->guestCalendarWriter->write($guest, $status, $token));
    }
}
