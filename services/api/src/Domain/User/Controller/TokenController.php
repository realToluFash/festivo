<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Http\IssuedTokensResponse;
use App\Domain\User\TokenIssuer;
use App\Entity\RefreshToken;
use App\Enum\ErrorCode;
use App\Enum\RefreshTokenDelivery;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Http\RefreshTokenCookies;
use App\Repository\RefreshTokenRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Psr\Log\LoggerInterface;
use SensitiveParameter;
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
        $body = self::parse($request);
        $delivery = $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body;

        $token = $this->find($this->presented($request, $body, $delivery) ?? throw $this->refuse());

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

        return new IssuedTokensResponse($tokens, $delivery, $request);
    }

    /** One token, not the chain: signing out of a device is not reporting a theft. */
    #[Route('/api/auth/logout', name: 'auth_logout', methods: ['POST'])]
    public function signOut(Request $request): JsonResponse
    {
        $body = self::parse($request);
        $delivery = $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body;
        $plain = $this->presented($request, $body, $delivery);

        $response = new JsonResponse(null, Response::HTTP_NO_CONTENT);

        if (RefreshTokenDelivery::Cookie === $delivery) {
            RefreshTokenCookies::clearOn($response, $request);
        }

        // No cookie to send is the same situation as already signed out, and
        // refusing it would leave a browser unable to finish the one action
        // that has no other way through.
        if (null === $plain) {
            return $response;
        }

        $token = $this->find($plain);

        if (null === $token->getRevokedAt()) {
            $token->setRevokedAt(new DateTimeImmutable());
            $this->entityManager->flush();
        }

        return $response;
    }

    /** @return array{refreshToken?: string, refreshTokenIn?: RefreshTokenDelivery} */
    private static function parse(Request $request): array
    {
        return Input::body($request, Type\shape([
            'refreshToken' => Type\optional(Type\string()),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));
    }

    /**
     * The JSON body is load-bearing, not decoration. A cookie client sends no
     * token of its own, so the request carries nothing an attacker's page could
     * not also produce — except that the shape is JSON with no unknown fields,
     * which an HTML form cannot be made to send. SameSite=Strict is the first
     * answer to that; this is the second.
     *
     * @param array{refreshToken?: string, refreshTokenIn?: RefreshTokenDelivery} $body
     */
    private function presented(Request $request, array $body, RefreshTokenDelivery $delivery): ?string
    {
        if (RefreshTokenDelivery::Cookie === $delivery) {
            return RefreshTokenCookies::readFrom($request);
        }

        return $body['refreshToken'] ?? throw ApiException::validation([[
            'propertyPath' => 'refreshToken',
            'message' => 'A refresh token is required unless refreshTokenIn is "cookie".',
            'code' => 'blank',
        ]], 'The request does not have the expected shape.');
    }

    private function find(#[SensitiveParameter] string $plain): RefreshToken
    {
        return $this->refreshTokenRepository->findOneByHash(TokenIssuer::hash($plain)) ?? throw $this->refuse();
    }

    /** One answer for unknown, expired, revoked and replayed alike. */
    private function refuse(): ApiException
    {
        return new ApiException(ErrorCode::InvalidRefreshToken, 'Your session has ended. Please sign in again.');
    }
}
