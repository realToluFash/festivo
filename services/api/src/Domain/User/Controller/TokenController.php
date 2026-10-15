<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\TokenIssuer;
use App\Entity\RefreshToken;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\RefreshTokenRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class TokenController
{
    public function __construct(
        private readonly RefreshTokenRepository $refreshTokenRepository,
        private readonly TokenIssuer $tokenIssuer,
        private readonly EntityManagerInterface $entityManager,
        private readonly LoggerInterface $logger,
    ) {
    }

    #[Route('/api/auth/refresh', name: 'auth_refresh', methods: ['POST'])]
    public function refresh(Request $request): JsonResponse
    {
        $token = $this->find($request);

        // Already exchanged, so two parties hold it. The whole chain goes.
        if (null !== $token->getRevokedAt()) {
            $this->tokenIssuer->revokeChain($token);
            $this->entityManager->flush();

            $this->logger->warning('Refresh token replayed; chain revoked', [
                'chain' => $token->getChainId()->toRfc4122(),
                'user' => $token->getUser()->getId()->toRfc4122(),
            ]);

            throw $this->refuse();
        }

        if (!$token->isUsable()) {
            throw $this->refuse();
        }

        $tokens = $this->tokenIssuer->rotate($token, $request);
        $this->entityManager->flush();

        return new JsonResponse([
            'accessToken' => $tokens->accessToken,
            'refreshToken' => $tokens->refreshToken,
            'refreshExpiresAt' => $tokens->refreshExpiresAt->format(\DATE_ATOM),
            'sessionId' => $tokens->sessionId->toRfc4122(),
        ]);
    }

    /** One token, not the chain: signing out of a device is not reporting a theft. */
    #[Route('/api/auth/logout', name: 'auth_logout', methods: ['POST'])]
    public function signOut(Request $request): JsonResponse
    {
        $token = $this->find($request);

        if (null === $token->getRevokedAt()) {
            $token->setRevokedAt(new DateTimeImmutable());
            $this->entityManager->flush();
        }

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    private function find(Request $request): RefreshToken
    {
        $body = Input::body($request, Type\shape(['refreshToken' => Type\string()]));

        $token = $this->refreshTokenRepository->findOneByHash(TokenIssuer::hash($body['refreshToken']));

        if (null === $token) {
            throw $this->refuse();
        }

        return $token;
    }

    /** One answer for unknown, expired, revoked and replayed alike. */
    private function refuse(): ApiException
    {
        return new ApiException(ErrorCode::InvalidRefreshToken, 'Your session has ended. Please sign in again.');
    }
}
