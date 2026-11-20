<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SingleSignOn;

use App\Domain\Organisation\Interfaces\ProviderDocumentsInterface;
use App\Domain\Organisation\SingleSignOn\Model\OidcEndpoints;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;

/** The rest of an OpenID Connect provider, read from its issuer's discovery document, which must name that same issuer. */
final readonly class OidcDiscovery
{
    public function __construct(
        private ProviderDocumentsInterface $providerDocuments,
    ) {
    }

    public static function issuerOf(string $typed): string
    {
        return Str\trim_right(Str\trim($typed), '/');
    }

    public static function documentAt(string $issuer): string
    {
        return self::issuerOf($issuer) . '/.well-known/openid-configuration';
    }

    public function discover(string $issuer): ?OidcEndpoints
    {
        $body = $this->providerDocuments->fetch(self::documentAt($issuer));

        if (null === $body) {
            return null;
        }

        try {
            $document = Type\shape([
                'issuer' => Type\non_empty_string(),
                'authorization_endpoint' => Type\non_empty_string(),
                'token_endpoint' => Type\non_empty_string(),
                'jwks_uri' => Type\non_empty_string(),
            ], true)->coerce(Json\decode($body));
        } catch (Json\Exception\DecodeException|Type\Exception\CoercionException) {
            return null;
        }

        if (self::issuerOf($document['issuer']) !== self::issuerOf($issuer)) {
            return null;
        }

        foreach ([$document['authorization_endpoint'], $document['token_endpoint'], $document['jwks_uri']] as $endpoint) {
            if (!Regex\matches($endpoint, '/^https:\/\/\S+$/i')) {
                return null;
            }
        }

        return new OidcEndpoints($document['issuer'], $document['authorization_endpoint'], $document['token_endpoint'], $document['jwks_uri']);
    }
}
