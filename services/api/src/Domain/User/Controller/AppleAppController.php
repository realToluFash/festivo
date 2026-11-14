<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Http\SignInResponse;
use App\Domain\User\Provider\AppleAppReturn;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

/** Sign in with Apple from the Android app: start an attempt, then trade the App Link's handle for a session. */
#[PublicAccess]
final readonly class AppleAppController
{
    public function __construct(
        private AppleAppReturn $appleAppReturn,
        private SignInResponse $signInResponse,
        private RateLimiterFactoryInterface $appleAppAttemptLimiter,
    ) {
    }

    #[Route('/api/auth/oauth/apple/attempts', name: 'auth_oauth_apple_attempt', methods: ['POST'])]
    public function start(Request $request): Response
    {
        $limit = $this->appleAppAttemptLimiter->create($request->getClientIp())->consume();

        if (!$limit->isAccepted()) {
            throw ApiException::tooManyAttempts('limits.sign_in', $limit->getRetryAfter());
        }

        $body = Input::body($request, Type\shape(['state' => Type\string(), 'codeChallenge' => Type\string()]));
        $this->appleAppReturn->start($body['state'], $body['codeChallenge']);

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/api/auth/oauth/apple/handle', name: 'auth_oauth_apple_handle', methods: ['POST'])]
    public function exchange(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'handle' => Type\string(),
            'codeVerifier' => Type\string(),
            'redirectUri' => Type\optional(Type\string()),
            'nonce' => Type\optional(Type\nullable(Type\string())),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));

        $result = $this->appleAppReturn->exchange($body['handle'], $body['codeVerifier'], $body['nonce'] ?? null, $body['redirectUri'] ?? null, $request);

        // Two-factor gates this way in as it gates every other: a challenge, not tokens, until the code passes.
        return $this->signInResponse->for($result->admission, $result->user, $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body, $request, ['linked' => $result->linked]);
    }
}
