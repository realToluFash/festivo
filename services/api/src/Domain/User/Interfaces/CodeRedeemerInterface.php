<?php

declare(strict_types=1);

namespace App\Domain\User\Interfaces;

use App\Enum\IdentityProvider;
use App\Http\Exception\ApiException;
use SensitiveParameter;

/** A browser cannot keep a client secret (RFC 6749 §2.1), so the API redeems a web client's code with it. */
interface CodeRedeemerInterface
{
    /**
     * The ID token the provider issues for this code, redeemed with the verifier the browser kept.
     *
     * @throws ApiException oauth_token_invalid, when the provider refuses the code
     */
    public function redeem(
        IdentityProvider $provider,
        #[SensitiveParameter]
        string $code,
        #[SensitiveParameter]
        string $codeVerifier,
        string $redirectUri,
    ): string;
}
