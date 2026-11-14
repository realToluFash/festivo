<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\OpenIdConnect;

use App\Domain\User\Interfaces\CodeRedeemerInterface;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Http\Exception\ApiException;
use SensitiveParameter;

/** A provider's token endpoint the suite controls: a code it was given redeems, with its verifier only. */
final class TestCodeRedeemer implements CodeRedeemerInterface
{
    /** @var array<string, array{verifier: string, idToken: string}> */
    private array $codes = [];

    /** @var list<array{code: string, redirectUri: string}> */
    public array $redeemed = [];

    public function issue(string $code, #[SensitiveParameter] string $verifier, #[SensitiveParameter] string $idToken): void
    {
        $this->codes[$code] = ['verifier' => $verifier, 'idToken' => $idToken];
    }

    public function redeem(
        IdentityProvider $provider,
        #[SensitiveParameter]
        string $code,
        #[SensitiveParameter]
        string $codeVerifier,
        string $redirectUri,
    ): string {
        $issued = $this->codes[$code] ?? null;
        unset($this->codes[$code]);

        if (null === $issued || !\hash_equals($issued['verifier'], $codeVerifier)) {
            throw new ApiException(ErrorCode::OAuthTokenInvalid, 'The provider would not redeem that code.');
        }

        $this->redeemed[] = ['code' => $code, 'redirectUri' => $redirectUri];

        return $issued['idToken'];
    }
}
