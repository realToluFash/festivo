<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\Organisation\SignInRules\SignInRules;
use App\Domain\User\Http\IssuedTokensResponse;
use App\Domain\User\Model\IssuedTokens;
use App\Domain\User\TokenIssuer;
use App\Entity\RefreshToken;
use App\Enum\ErrorCode;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Exception\ShapeRefusal;
use App\Http\Input;
use App\Http\RefreshTokenCookies;
use App\Repository\RefreshTokenRepository;
use DateInterval;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

#[PublicAccess]
final class TokenController
{
    public function __construct(
        private readonly RefreshTokenRepository $refreshTokenRepository,
        private readonly TokenIssuer $tokenIssuer,
        private readonly EntityManagerInterface $entityManager,
        private readonly LoggerInterface $logger,
        private readonly SignInRules $signInRules,
        private readonly ClockInterface $clock,
        private readonly TranslatorInterface $translator,
    ) {
    }

    #[Route('/api/auth/refresh', name: 'auth_refresh', methods: ['POST'])]
    public function refresh(Request $request): JsonResponse
    {
        $body = self::parse($request);
        $delivery = $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body;

        $token = $this->find($this->presented($request, $body, $delivery) ?? throw $this->refuse());

        // Returned rather than thrown, so the transaction keeps the chain it ended on the way to the refusal.
        $issued = $this->entityManager->wrapInTransaction(fn (): IssuedTokens|ApiException => $this->rotate($token, $request));

        if ($issued instanceof ApiException) {
            throw $issued;
        }

        return new IssuedTokensResponse($issued, $delivery, $request);
    }

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

        if (null === $plain) {
            return $response;
        }

        $token = $this->find($plain);

        $this->entityManager->wrapInTransaction(function () use ($token): void {
            $this->tokenIssuer->holdChain($token);
            $this->tokenIssuer->revokeChain($token);
        });

        return $response;
    }

    private function rotate(#[SensitiveParameter] RefreshToken $token, Request $request): IssuedTokens|ApiException
    {
        $this->tokenIssuer->holdChain($token);

        if (null !== $token->getRevokedAt()) {
            // A chain with nothing live left was ended by a sign-out, not robbed.
            if ($this->tokenIssuer->revokeChain($token) > 0) {
                $this->logger->warning('Refresh token replayed; chain revoked', [
                    'chain' => $token->getChainId()->toRfc4122(),
                    'user' => $token->getUser()->getId()->toRfc4122(),
                ]);
            }

            return $this->refuse();
        }

        if (!$token->isUsable()) {
            return $this->refuse();
        }

        return $this->endIfIdle($token) ?? $this->endIfPasswordRefused($token) ?? $this->tokenIssuer->rotate($token, $request);
    }

    /** A token is issued at each use, so its age is how long the session has gone unused. */
    private function endIfIdle(#[SensitiveParameter] RefreshToken $token): ?ApiException
    {
        $user = $token->getUser();
        $limit = $this->signInRules->inactivityLimit($user);

        if (null === $limit || $token->getCreatedAt() > $this->clock->now()->sub(new DateInterval(Str\format('P%dD', $limit->days)))) {
            return null;
        }

        $this->tokenIssuer->revokeChain($token);

        return new ApiException(
            ErrorCode::SessionTimedOut,
            'sign_in.idle_timeout',
            [],
            null,
            [],
            [
                'organisation' => $limit->organisation->getName(),
                'days' => $limit->days,
                'email' => $user->getPrimaryEmailAddress()?->getAddress() ?? '',
            ],
            ['{organisation}' => $limit->organisation->getName(), '{days}' => (string) $limit->days],
        );
    }

    /** A session a password opened ends once the rule turns that password away, as the next sign-in would (sc-69). */
    private function endIfPasswordRefused(#[SensitiveParameter] RefreshToken $token): ?ApiException
    {
        $refusal = null === $token->getSignedInWith() ? $this->signInRules->passwordRefusal($token->getUser()) : null;

        if (null === $refusal) {
            return null;
        }

        $this->tokenIssuer->revokeChain($token);

        return $refusal;
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
     * @param array{refreshToken?: string, refreshTokenIn?: RefreshTokenDelivery} $body
     */
    private function presented(Request $request, array $body, RefreshTokenDelivery $delivery): ?string
    {
        if (RefreshTokenDelivery::Cookie === $delivery) {
            return RefreshTokenCookies::readFrom($request);
        }

        return $body['refreshToken'] ?? throw ApiException::validation([[
            'propertyPath' => 'refreshToken',
            'message' => $this->translator->trans(ShapeRefusal::FIELD),
            'code' => 'blank',
        ]], $this->translator->trans(ShapeRefusal::REQUEST));
    }

    private function find(#[SensitiveParameter] string $plain): RefreshToken
    {
        return $this->refreshTokenRepository->findOneByHash(TokenIssuer::hash($plain)) ?? throw $this->refuse();
    }

    private function refuse(): ApiException
    {
        return new ApiException(ErrorCode::InvalidRefreshToken, 'sign_in.session_ended');
    }
}
