<?php

declare(strict_types=1);

namespace App\Domain\Staff\Controller;

use App\Domain\Staff\Attendance\Clocking;
use App\Domain\Staff\Http\ClockCardSerialiser;
use App\Domain\Staff\Link\StaffLinkGrants;
use App\Domain\Staff\Link\StaffLinks;
use App\Domain\User\CallerSession;
use App\Domain\User\TokenIssuer;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\RefreshTokenRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** Clocking in and out from a person's own night (sc-234), at their link in a browser or in the app; inside the link's window, and past it while still clocked in. */
final readonly class StaffClockController
{
    public function __construct(
        private Security $security,
        private StaffLinks $staffLinks,
        private StaffLinkGrants $staffLinkGrants,
        private Clocking $clocking,
        private RateLimiterFactoryInterface $staffLinkLimiter,
        private CallerSession $callerSession,
        private RefreshTokenRepository $refreshTokenRepository,
        private TokenIssuer $tokenIssuer,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    /** The entry's own account alone, as the night; a browser past access is signed out with its clock-out (`signedOut`). */
    #[Route('/api/staff-links/clock', name: 'staff_links_clock', methods: ['POST'])]
    #[PublicAccess]
    public function atLink(Request $request): JsonResponse
    {
        $limit = $this->staffLinkLimiter->create($request->getClientIp() ?? 'anonymous')->consume();

        if (!$limit->isAccepted()) {
            throw ApiException::tooManyAttempts('limits.staff_links', $limit->getRetryAfter());
        }

        $body = Input::body($request, Type\shape(['token' => Type\string(), 'action' => Type\union(Type\literal_scalar('in'), Type\literal_scalar('out'))]));
        $entry = $this->staffLinks->find($body['token']) ?? throw ApiException::notFound('access.not_found');
        $reader = $this->security->getUser();
        $window = $this->staffLinks->window($entry);

        if (!$reader instanceof User || true !== $entry->getAccount()?->getId()->equals($reader->getId()) || (!$window->open && null === $window->clockUntil)) {
            throw ApiException::notFound('access.not_found');
        }

        return $this->clocked($entry, $body['action'], $reader, true);
    }

    #[Route('/api/events/{eventId}/my-night/clock', name: 'staff_my_night_clock', methods: ['POST'])]
    #[Authenticated]
    public function inApp(string $eventId, Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['action' => Type\union(Type\literal_scalar('in'), Type\literal_scalar('out'))]));
        $user = $this->user();
        $event = Uuid::isValid($eventId) ? Uuid::fromString($eventId) : null;
        $grant = null === $event ? null : Iter\first([...$this->staffLinkGrants->live($user, $event), ...$this->staffLinkGrants->clockOnly($user, $event)]);

        if (null === $grant) {
            throw ApiException::notFound('access.not_found');
        }

        return $this->clocked($grant['entry'], $body['action'], $user, false);
    }

    private function clocked(StaffMember $entry, string $action, User $user, bool $inBrowser): JsonResponse
    {
        $done = 'in' === $action ? $this->clocking->clockIn($entry, $user) : $this->clocking->clockOut($entry, $user);
        $card = ClockCardSerialiser::card($done['shift'], $done['attendance'], $this->clock->now());

        return new JsonResponse([
            'outcome' => $done['recorded'] ? 'recorded' : 'already',
            'clock' => $card,
            'signedOut' => $inBrowser && 'out' === $action && $this->signOutIfEnded($user),
        ]);
    }

    /** A browser signed in by phone code ends with its last grant (sc-4235): once a clock-out past access leaves none, it ends now rather than at its next refresh. */
    private function signOutIfEnded(User $user): bool
    {
        $chain = $this->callerSession->chain();
        $session = null === $chain ? null : $this->refreshTokenRepository->findOneBy(['chainId' => $chain]);

        if (null === $session || !$session->endsWithGrants() || $this->tokenIssuer->grantsEndFor($user) > $this->clock->now()) {
            return false;
        }

        $this->entityManager->wrapInTransaction(function () use ($session): void {
            $this->tokenIssuer->holdChain($session);
            $this->tokenIssuer->revokeChain($session);
        });

        return true;
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
