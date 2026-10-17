<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Http\SignInResponse;
use App\Domain\User\Provider\ProviderSignIn;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** Answers exactly as password sign-in does, with `linked` for the one-time "now linked" notice. */
#[PublicAccess]
final readonly class ProviderSignInController
{
    public function __construct(
        private ProviderSignIn $providerSignIn,
        private SignInResponse $signInResponse,
    ) {
    }

    #[Route('/api/auth/oauth/{provider}', name: 'auth_oauth_provider', requirements: ['provider' => 'google|apple'], methods: ['POST'])]
    public function signIn(Request $request, string $provider): JsonResponse
    {
        $identityProvider = IdentityProvider::from($provider);

        // The app sends the ID token it got with PKCE; the web sends its code, which only the API can redeem.
        $body = Input::body($request, Type\shape([
            'idToken' => Type\optional(Type\string()),
            'code' => Type\optional(Type\string()),
            'codeVerifier' => Type\optional(Type\string()),
            'redirectUri' => Type\optional(Type\string()),
            'nonce' => Type\optional(Type\nullable(Type\string())),
            'name' => Type\optional(Type\nullable(Type\string())),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));

        $nonce = $body['nonce'] ?? null;

        $result = match (true) {
            isset($body['code'], $body['codeVerifier'], $body['redirectUri']) => $this->providerSignIn->signInWithCode(
                $identityProvider,
                $body['code'],
                $body['codeVerifier'],
                $body['redirectUri'],
                $nonce,
                $request,
                $body['name'] ?? null,
            ),
            isset($body['idToken']) => $this->providerSignIn->signIn($identityProvider, $body['idToken'], $nonce, $request, $body['name'] ?? null),
            default => throw new ApiException(ErrorCode::BadRequest, 'Send an idToken, or a code with its codeVerifier and redirectUri.'),
        };

        return $this->signInResponse->for($result->admission, $result->user, $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body, $request, ['linked' => $result->linked]);
    }
}
