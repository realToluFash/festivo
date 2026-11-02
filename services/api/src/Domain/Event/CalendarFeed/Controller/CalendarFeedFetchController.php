<?php

declare(strict_types=1);

namespace App\Domain\Event\CalendarFeed\Controller;

use App\Deletion\RestoreWindow;
use App\Domain\Event\CalendarFeed\CalendarFeedWriter;
use App\Domain\Event\CalendarFeed\FeedLinkIssuer;
use App\Domain\User\Mail\AccountLanguage;
use App\Enum\Permission;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\PublicAccess;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Repository\CalendarFeedRepository;
use App\Repository\EventRepository;
use Psl\Str;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Translation\LocaleSwitcher;

/**
 * The subscription a calendar app fetches (sc-3626). The token is its only credential, so whose it is and what they may see are read again on every fetch: a member who left, was suspended or lost events.read gets the same 404 as a link that never existed.
 */
#[PublicAccess]
final readonly class CalendarFeedFetchController
{
    public function __construct(
        private CalendarFeedRepository $calendarFeedRepository,
        private EventRepository $eventRepository,
        private MembershipDirectoryInterface $membershipDirectory,
        private CalendarFeedWriter $calendarFeedWriter,
        private AccountLanguage $accountLanguage,
        private LocaleSwitcher $localeSwitcher,
        private RateLimiterFactoryInterface $calendarFeedTokenLimiter,
        private ClockInterface $clock,
    ) {
    }

    // @mago-expect lint:no-literal-password the pattern of the link's token, not a token
    #[Route('/api/calendar-feeds/{token}.ics', name: 'calendar_feed', requirements: ['token' => '[A-Za-z0-9_-]{43}'], methods: ['GET'])]
    public function fetch(Request $request, #[SensitiveParameter] string $token): Response
    {
        $hash = FeedLinkIssuer::hash($token);
        $limit = $this->calendarFeedTokenLimiter->create($hash)->consume();

        if (!$limit->isAccepted()) {
            throw ApiException::tooManyAttempts('limits.calendar_feed', $limit->getRetryAfter());
        }

        $feed = $this->calendarFeedRepository->findOneByTokenHash($hash) ?? throw ApiException::notFound('access.not_found');
        $user = $feed->getUser();
        $organisation = $feed->getOrganisation();
        $grants = $this->membershipDirectory->grantsIn($user, $organisation->getId());

        if (null === $grants || !$grants->holds(Permission::EventsRead)) {
            throw ApiException::notFound('access.not_found');
        }

        $now = $this->clock->now();
        $events = $this->eventRepository->findForCalendarFeed($organisation, RestoreWindow::openForDeletionsAfter($now));
        $body = $this->localeSwitcher->runWithLocale(
            $this->accountLanguage->of($user),
            fn (): string => $this->calendarFeedWriter->write($organisation, $events, $grants, $now),
        );
        $tag = '"' . Str\slice(\hash('sha256', $body), 0, 32) . '"';
        $headers = ['ETag' => $tag, 'Cache-Control' => 'private, no-cache'];
        $ifNoneMatch = $request->headers->get('If-None-Match');

        if (null !== $ifNoneMatch && ('*' === Str\trim($ifNoneMatch) || EntityTag::matches($ifNoneMatch, $tag))) {
            return new Response(null, Response::HTTP_NOT_MODIFIED, $headers);
        }

        return new Response($body, Response::HTTP_OK, [...$headers, 'Content-Type' => 'text/calendar; charset=utf-8']);
    }
}
