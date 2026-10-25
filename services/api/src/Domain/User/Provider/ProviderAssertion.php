<?php

declare(strict_types=1);

namespace App\Domain\User\Provider;

use App\Domain\User\Interfaces\CodeRedeemerInterface;
use App\Domain\User\Interfaces\IdTokenVerifierInterface;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Http\Exception\ApiException;
use Psl\Type;

/** A provider sign-in run by somebody already signed in, checked for what it vouches for and nothing more. */
final readonly class ProviderAssertion
{
    public function __construct(
        private IdTokenVerifierInterface $idTokenVerifier,
        private CodeRedeemerInterface $codeRedeemer,
        private AppleAppReturn $appleAppReturn,
    ) {
    }

    /**
     * The three ways a client hands one over, as sign-in takes them: an app's ID token, the web's code, Android's Apple handle.
     *
     * @return Type\TypeInterface<array{idToken?: string, code?: string, codeVerifier?: string, redirectUri?: string, handle?: string, nonce?: ?string}>
     */
    public static function shape(): Type\TypeInterface
    {
        return Type\shape([
            'idToken' => Type\optional(Type\string()),
            'code' => Type\optional(Type\string()),
            'codeVerifier' => Type\optional(Type\string()),
            'redirectUri' => Type\optional(Type\string()),
            'handle' => Type\optional(Type\string()),
            'nonce' => Type\optional(Type\nullable(Type\string())),
        ]);
    }

    /** @param array{idToken?: string, code?: string, codeVerifier?: string, redirectUri?: string, handle?: string, nonce?: ?string} $sent */
    public function claims(IdentityProvider $provider, array $sent): ProviderClaims
    {
        $idToken = match (true) {
            IdentityProvider::Apple === $provider && isset($sent['handle'], $sent['codeVerifier']) => $this->codeRedeemer->redeem(
                $provider,
                $this->appleAppReturn->spend($sent['handle'], $sent['codeVerifier'], $sent['redirectUri'] ?? null)[0],
                $sent['codeVerifier'],
                $this->appleAppReturn->returnUri(),
            ),
            isset($sent['code'], $sent['codeVerifier'], $sent['redirectUri']) => $this->codeRedeemer->redeem($provider, $sent['code'], $sent['codeVerifier'], $sent['redirectUri']),
            isset($sent['idToken']) => $sent['idToken'],
            default => throw new ApiException(ErrorCode::BadRequest, 'provider.token_code_or_handle'),
        };

        return $this->idTokenVerifier->verify($provider, $idToken, $sent['nonce'] ?? null);
    }
}
