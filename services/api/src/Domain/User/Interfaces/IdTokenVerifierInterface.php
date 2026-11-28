<?php

declare(strict_types=1);

namespace App\Domain\User\Interfaces;

use App\Domain\User\Provider\ProviderClaims;
use App\Enum\IdentityProvider;
use App\Http\Exception\ApiException;
use SensitiveParameter;

interface IdTokenVerifierInterface
{
    /**
     * The claims of an ID token whose signature, issuer, audience, expiry and nonce all check out.
     *
     * @throws ApiException oauth_token_invalid, for any of them failing
     */
    public function verify(
        IdentityProvider $provider,
        #[SensitiveParameter]
        string $idToken,
        #[SensitiveParameter]
        ?string $rawNonce,
    ): ProviderClaims;
}
