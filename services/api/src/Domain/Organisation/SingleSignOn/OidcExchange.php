<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SingleSignOn;

use App\Domain\Organisation\Interfaces\ProviderDocumentsInterface;
use App\Entity\SsoProvider;
use Psl\Json;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Type;
use SensitiveParameter;

/** The authorization code flow with PKCE against an organisation's provider (sc-610): Test sign-on and sign-in send and redeem alike. */
final readonly class OidcExchange
{
    public function __construct(
        private SingleSignOnSettings $settings,
        private ServiceUrls $serviceUrls,
        private ProviderDocumentsInterface $providerDocuments,
    ) {
    }

    public function authorizationUrl(SsoProvider $provider, #[SensitiveParameter] string $state, string $nonce, #[SensitiveParameter] string $verifier): string
    {
        $endpoint = $provider->getOidcAuthorizationEndpoint() ?? '';

        return $endpoint . (Str\contains($endpoint, '?') ? '&' : '?') . \http_build_query([
            'response_type' => 'code',
            'client_id' => $provider->getOidcClientId(),
            'redirect_uri' => $this->serviceUrls->oidcRedirectUrl($provider->getOrganisation()),
            'scope' => 'openid email profile',
            'state' => $state,
            'nonce' => $nonce,
            'code_challenge' => self::challengeOf($verifier),
            'code_challenge_method' => 'S256',
        ]);
    }

    /** @return array{id_token?: non-empty-string, error?: non-empty-string, error_description?: non-empty-string, ...} */
    public function redeem(SsoProvider $provider, #[SensitiveParameter] string $code, #[SensitiveParameter] string $verifier): array
    {
        $body = $this->providerDocuments->redeem(
            $provider->getOidcTokenEndpoint() ?? '',
            $provider->getOidcClientId() ?? '',
            $this->settings->openSecret($provider) ?? '',
            [
                'grant_type' => 'authorization_code',
                'code' => $code,
                'code_verifier' => $verifier,
                'redirect_uri' => $this->serviceUrls->oidcRedirectUrl($provider->getOrganisation()),
            ],
        );

        if (null === $body) {
            return [];
        }

        try {
            return Type\shape([
                'id_token' => Type\optional(Type\non_empty_string()),
                'error' => Type\optional(Type\non_empty_string()),
                'error_description' => Type\optional(Type\non_empty_string()),
            ], true)->coerce(Json\decode($body));
        } catch (Json\Exception\DecodeException|Type\Exception\CoercionException) {
            return [];
        }
    }

    /** RFC 7636 S256: base64url of the SHA-256 of the verifier, unpadded. */
    public static function challengeOf(#[SensitiveParameter] string $verifier): string
    {
        return Str\trim_right(Str\replace_every(\base64_encode(\hash('sha256', $verifier, true)), ['+' => '-', '/' => '_']), '=');
    }

    public static function random(): string
    {
        return \bin2hex(SecureRandom\bytes(32));
    }
}
