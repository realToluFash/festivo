<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Entity\RefreshToken;
use App\Entity\User;
use App\Enum\ErrorCode;
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

final class AccountController
{
    public function __construct(
        private readonly Security $security,
        private readonly RefreshTokenRepository $refreshTokenRepository,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    #[Route('/api/auth/me', name: 'auth_me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        $user = $this->user();

        return new JsonResponse([
            'id' => $user->getId()->toRfc4122(),
            'name' => $user->getName(),
            'businessName' => $user->getBusinessName(),
            'countryCode' => $user->getCountryCode(),
            'locale' => $user->getLocale(),
            'verified' => $user->isVerified(),
            'complete' => $user->isComplete(),
            'emailAddresses' => Vec\map($user->getEmailAddresses(), static fn ($address): array => [
                'id' => $address->getId()->toRfc4122(),
                'address' => $address->getAddress(),
                'verified' => $address->isVerified(),
                'primary' => $address->isPrimary(),
            ]),
            'phoneNumbers' => Vec\map($user->getPhoneNumbers(), static fn ($phone): array => [
                'id' => $phone->getId()->toRfc4122(),
                'number' => $phone->getNumber(),
                'verified' => $phone->isVerified(),
                'primary' => $phone->isPrimary(),
            ]),
        ]);
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
