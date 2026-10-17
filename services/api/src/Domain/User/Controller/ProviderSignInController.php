<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Http\AccountSerialiser;
use App\Domain\User\Http\IssuedTokensResponse;
use App\Domain\User\Provider\ProviderSignIn;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** Answers exactly as password sign-in does, with `linked` for the one-time "now linked" notice. */
#[PublicAccess]
final readonly class ProviderSignInController
{
    public function __construct(
        private ProviderSignIn $providerSignIn,
        private AccountSerialiser $accountSerialiser,
    ) {
    }

    #[Route('/api/auth/oauth/google', name: 'auth_oauth_google', methods: ['POST'])]
    public function google(Request $request): IssuedTokensResponse
    {
        // The app sends the ID token it got with PKCE; the web sends its code, which only the API can redeem.
        $body = Input::body($request, Type\shape([
            'idToken' => Type\optional(Type\string()),
            'code' => Type\optional(Type\string()),
            'codeVerifier' => Type\optional(Type\string()),
            'redirectUri' => Type\optional(Type\string()),
            'nonce' => Type\optional(Type\nullable(Type\string())),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));

        $nonce = $body['nonce'] ?? null;

        $result = match (true) {
            isset($body['code'], $body['codeVerifier'], $body['redirectUri']) => $this->providerSignIn->signInWithCode(
                IdentityProvider::Google,
                $body['code'],
                $body['codeVerifier'],
                $body['redirectUri'],
                $nonce,
                $request,
            ),
            isset($body['idToken']) => $this->providerSignIn->signIn(IdentityProvider::Google, $body['idToken'], $nonce, $request),
            default => throw new ApiException(ErrorCode::BadRequest, 'Send an idToken, or a code with its codeVerifier and redirectUri.'),
        };

        return new IssuedTokensResponse(
            $result->tokens,
            $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body,
            $request,
            ['account' => $this->accountSerialiser->serialise($result->user), 'linked' => $result->linked],
        );
    }
}
