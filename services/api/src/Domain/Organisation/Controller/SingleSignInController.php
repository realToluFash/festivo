<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\SingleSignOn\SingleSignIn;
use App\Domain\User\Http\SignInResponse;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

/** Signing in through an organisation's identity provider (sc-610): where to go, then the one-time handle for a session. */
#[PublicAccess]
final readonly class SingleSignInController
{
    public function __construct(
        private SingleSignIn $singleSignIn,
        private SignInResponse $signInResponse,
        private RateLimiterFactoryInterface $ssoSignInLimiter,
    ) {
    }

    #[Route('/api/auth/sso/attempts', name: 'auth_sso_attempt', methods: ['POST'])]
    public function start(Request $request): JsonResponse
    {
        $limit = $this->ssoSignInLimiter->create($request->getClientIp())->consume();

        if (!$limit->isAccepted()) {
            throw ApiException::tooManyAttempts('limits.sign_in', $limit->getRetryAfter());
        }

        $body = Input::body($request, Type\shape(['email' => Type\string(), 'codeChallenge' => Type\string()]));

        return new JsonResponse($this->singleSignIn->start($body['email'], $body['codeChallenge']));
    }

    #[Route('/api/auth/sso/handle', name: 'auth_sso_handle', methods: ['POST'])]
    public function exchange(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'handle' => Type\string(),
            'codeVerifier' => Type\string(),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));
        [$user, $admission] = $this->singleSignIn->exchange($body['handle'], $body['codeVerifier'], $request);

        return $this->signInResponse->for($admission, $user, $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body, $request);
    }
}
