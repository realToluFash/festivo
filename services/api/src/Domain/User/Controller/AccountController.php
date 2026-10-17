<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\CallerSession;
use App\Domain\User\Http\AccountSerialiser;
use App\Domain\User\SignOutEverywhereElse;
use App\Domain\User\TimeZone\AccountTimeZone;
use App\Domain\User\TimeZone\TimeZoneList;
use App\Domain\User\TokenIssuer;
use App\Entity\RefreshToken;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Locale\SupportedLocales;
use App\Repository\RefreshTokenRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

#[Authenticated]
final class AccountController
{
    public function __construct(
        private readonly AccountSerialiser $accountSerialiser,
        private readonly Security $security,
        private readonly RefreshTokenRepository $refreshTokenRepository,
        private readonly TokenIssuer $tokenIssuer,
        private readonly EntityManagerInterface $entityManager,
        private readonly TranslatorInterface $translator,
        private readonly ClockInterface $clock,
        private readonly SignOutEverywhereElse $signOutEverywhereElse,
        private readonly CallerSession $callerSession,
    ) {
    }

    #[Route('/api/auth/me', name: 'auth_me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        return new JsonResponse($this->accountSerialiser->serialise($this->user()));
    }

    /** The language switcher, signed in: the account's language, which every device and every email then follow. */
    #[Route('/api/auth/locale', name: 'auth_locale', methods: ['PUT'])]
    public function setLocale(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['locale' => Type\string()]));

        if (!SupportedLocales::supports($body['locale'])) {
            throw ApiException::validation([[
                'propertyPath' => 'locale',
                'message' => 'Choose English, Español, Français or Português.',
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        $locale = SupportedLocales::narrow($body['locale']);
        $this->user()->setLocale($locale);
        $this->entityManager->flush();

        return new JsonResponse(['locale' => $locale]);
    }

    /** Settings > Account: the zone the times sent to this person are written in. Only an IANA zone is saved. */
    #[Route('/api/auth/timezone', name: 'auth_timezone', methods: ['PUT'])]
    public function setTimezone(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['timezone' => Type\string()]));

        $zone = AccountTimeZone::canonical($body['timezone']);

        if (null === $zone) {
            throw ApiException::validation([[
                'propertyPath' => 'timezone',
                'message' => $this->translator->trans('validation.timezone_unknown'),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        $this->user()->setTimezone($zone);
        $this->entityManager->flush();

        return new JsonResponse(['timezone' => $zone]);
    }

    /** Every IANA zone, named in the request's language, with its offset now: the list Settings > Account searches. */
    #[Route('/api/auth/timezones', name: 'auth_timezones', methods: ['GET'])]
    public function timezones(Request $request): JsonResponse
    {
        return new JsonResponse(['timezones' => TimeZoneList::at($this->clock->now(), $request->getLocale())]);
    }

    #[Route('/api/auth/sessions', name: 'auth_sessions', methods: ['GET'])]
    public function sessions(): JsonResponse
    {
        $sessions = $this->refreshTokenRepository->findUsableFor($this->user());

        return new JsonResponse([
            'sessions' => Vec\map($sessions, static fn (RefreshToken $session): array => [
                'id' => $session->getId()->toRfc4122(),
                'userAgent' => $session->getUserAgent(),
                'ipAddress' => $session->getIpAddress(),
                'startedAt' => $session->getChainStartedAt()->format(\DATE_ATOM),
                'renewedAt' => $session->getCreatedAt()->format(\DATE_ATOM),
                'expiresAt' => $session->getExpiresAt()->format(\DATE_ATOM),
            ]),
        ]);
    }

    /** With the proof from `/api/auth/proof` and the caller's own `sessionId`; without it, this device ends too. */
    #[Route('/api/auth/sessions/others', name: 'auth_sessions_others_end', methods: ['POST'])]
    public function endOthers(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'proof' => Type\optional(Type\nullable(Type\string())),
            'sessionId' => Type\optional(Type\nullable(Type\string())),
        ]));

        $session = $body['sessionId'] ?? null;

        return new JsonResponse($this->signOutEverywhereElse->signOut(
            $this->user(),
            $body['proof'] ?? null,
            null !== $session && Uuid::isValid($session) ? Uuid::fromString($session) : null,
            $this->callerSession->chain(),
        ));
    }

    #[Route('/api/auth/sessions/{id}', name: 'auth_session_end', methods: ['DELETE'])]
    public function endSession(string $id): JsonResponse
    {
        if (!Uuid::isValid($id)) {
            throw ApiException::notFound('No session with that id.');
        }

        $session = $this->refreshTokenRepository->find(Uuid::fromString($id));

        // not_found, not forbidden: the distinction would confirm it exists.
        if (null === $session || $session->getUser()->getId() !== $this->user()->getId()) {
            throw ApiException::notFound('No session with that id.');
        }

        $this->tokenIssuer->end($session);
        $this->entityManager->flush();

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        if (!$user instanceof User) {
            throw new ApiException(ErrorCode::Unauthenticated, 'Please sign in to continue.');
        }

        return $user;
    }
}
