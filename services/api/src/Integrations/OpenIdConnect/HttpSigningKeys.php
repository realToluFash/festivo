<?php

declare(strict_types=1);

namespace App\Integrations\OpenIdConnect;

use App\Enum\IdentityProvider;
use Psl\Type;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/** The provider's published key set, cached for an hour and fetched again on demand. */
final readonly class HttpSigningKeys implements SigningKeysInterface
{
    private const int CACHE_SECONDS = 3600;

    public function __construct(
        private HttpClientInterface $httpClient,
        private CacheInterface $cache,
        private string $googleJwksUris,
        private string $appleJwksUris,
    ) {
    }

    public function publicKey(IdentityProvider $provider, string $keyId, bool $fresh): ?string
    {
        $cacheKey = 'oidc_keys_' . $provider->value;

        $keys = $this->cache->get(
            $cacheKey,
            function (ItemInterface $item) use ($provider): array {
                $item->expiresAfter(self::CACHE_SECONDS);

                return $this->fetch($provider);
            },
            $fresh ? \INF : null,
        );

        return Type\dict(Type\string(), Type\string())->coerce($keys)[$keyId] ?? null;
    }

    /** @return array<string, string> PEM by key id, RSA signing keys only, from every set configured */
    private function fetch(IdentityProvider $provider): array
    {
        $uris = ConfiguredList::of(match ($provider) {
            IdentityProvider::Google => $this->googleJwksUris,
            IdentityProvider::Apple => $this->appleJwksUris,
        });

        $keys = [];

        // One set out of reach (Apple's, from a development machine offline) must not take the others with it.
        foreach ($uris as $uri) {
            try {
                $keys = [...$keys, ...$this->fetchSet($uri)];
            } catch (ExceptionInterface) {
                continue;
            }
        }

        return $keys;
    }

    /** @return array<string, string> */
    private function fetchSet(string $uri): array
    {
        $set = Type\shape([
            'keys' => Type\vec(Type\shape([
                'kty' => Type\string(),
                'kid' => Type\optional(Type\string()),
                'n' => Type\optional(Type\string()),
                'e' => Type\optional(Type\string()),
            ], true)),
        ], true)->coerce($this->httpClient->request('GET', $uri)->toArray());

        $keys = [];

        foreach ($set['keys'] as $key) {
            if ('RSA' === $key['kty'] && isset($key['kid'], $key['n'], $key['e'])) {
                $keys[$key['kid']] = RsaJwk::toPem($key['n'], $key['e']);
            }
        }

        return $keys;
    }
}
