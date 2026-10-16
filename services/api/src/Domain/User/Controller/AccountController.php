<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Http\AccountSerialiser;
use App\Entity\RefreshToken;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use App\Repository\RefreshTokenRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

#[Authenticated]
final class AccountController
{
    public function __construct(
        private readonly AccountSerialiser $accountSerialiser,
        private readonly Security $security,
        private readonly RefreshTokenRepository $refreshTokenRepository,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    #[Route('/api/auth/me', name: 'auth_me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        return new JsonResponse($this->accountSerialiser->serialise($this->user()));
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

        if (null === $session->getRevokedAt()) {
            $session->setRevokedAt(new DateTimeImmutable());
            $this->entityManager->flush();
        }

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
