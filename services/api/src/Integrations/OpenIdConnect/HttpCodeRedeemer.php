<?php

declare(strict_types=1);

namespace App\Integrations\OpenIdConnect;

use App\Domain\User\Interfaces\CodeRedeemerInterface;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Http\Exception\ApiException;
use Psl\Type;
use SensitiveParameter;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/** The web client's code, redeemed at the provider's token endpoint with the secret only the API holds. */
final readonly class HttpCodeRedeemer implements CodeRedeemerInterface
{
    public function __construct(
        private HttpClientInterface $httpClient,
        private string $googleRedemptionEndpoint,
        private string $googleWebClientId,
        #[SensitiveParameter]
        private string $googleWebClientSecret,
        private string $appleRedemptionEndpoint,
        private string $appleWebClientId,
        #[SensitiveParameter]
        private string $appleWebClientSecret,
    ) {
    }

    public function redeem(
        IdentityProvider $provider,
        #[SensitiveParameter]
        string $code,
        #[SensitiveParameter]
        string $codeVerifier,
        string $redirectUri,
    ): string {
        [$tokenUri, $clientId, $secret] = match ($provider) {
            IdentityProvider::Google => [$this->googleRedemptionEndpoint, $this->googleWebClientId, $this->googleWebClientSecret],
            IdentityProvider::Apple => [$this->appleRedemptionEndpoint, $this->appleWebClientId, $this->appleWebClientSecret],
        };

        try {
            $response = $this->httpClient->request('POST', $tokenUri, [
                'body' => [
                    'grant_type' => 'authorization_code',
                    'code' => $code,
                    'code_verifier' => $codeVerifier,
                    'redirect_uri' => $redirectUri,
                    'client_id' => $clientId,
                    'client_secret' => $secret,
                ],
            ]);

            $body = Type\shape(['id_token' => Type\non_empty_string()], true)->coerce($response->toArray());
        } catch (ExceptionInterface|Type\Exception\CoercionException) {
            throw new ApiException(ErrorCode::OAuthTokenInvalid, 'provider.code_not_redeemed');
        }

        return $body['id_token'];
    }
}
