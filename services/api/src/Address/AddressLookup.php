<?php

declare(strict_types=1);

namespace App\Address;

use Psr\Log\LoggerInterface;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

/**
 * The provider, with the things every caller would otherwise repeat.
 *
 * A short query is answered without asking anybody — typing "Lo" on the way to
 * "London" would otherwise be two billable lookups that could never have
 * matched anything useful.
 *
 * Identical queries are cached, because an autocomplete field fires on
 * keystrokes and the same prefix is asked for constantly while somebody
 * corrects a typo.
 */
final readonly class AddressLookup
{
    public const MIN_QUERY_LENGTH = 3;

    public function __construct(
        private AddressProvider $provider,
        private CacheInterface $cache,
        private LoggerInterface $logger,
        private int $suggestTtlSeconds = 3600,
        private int $resolveTtlSeconds = 86400,
    ) {
    }

    /** @return list<Suggestion> */
    public function suggest(string $query, ?string $countryCode = null): array
    {
        $trimmed = trim($query);

        // Short-circuited rather than asked. The provider cannot usefully
        // answer two characters and would bill for being asked.
        if (mb_strlen($trimmed) < self::MIN_QUERY_LENGTH) {
            return [];
        }

        return $this->cache->get(
            $this->key('suggest', $trimmed, $countryCode ?? ''),
            function (ItemInterface $item) use ($trimmed, $countryCode): array {
                $item->expiresAfter($this->suggestTtlSeconds);

                return $this->provider->suggest($trimmed, $countryCode);
            },
        );
    }

    /** @throws AddressNotFound|ProviderUnavailable */
    public function resolve(string $id): Address
    {
        return $this->cache->get(
            $this->key('resolve', $id),
            function (ItemInterface $item) use ($id): Address {
                // Longer than a suggestion: a resolved address does not change
                // while somebody is filling in a form, or indeed that year.
                $item->expiresAfter($this->resolveTtlSeconds);

                return $this->provider->resolve($id);
            },
        );
    }

    private function key(string $kind, string ...$parts): string
    {
        // Hashed, because a query is free text and a cache key may not contain
        // the reserved characters a person will eventually type into it.
        return sprintf('address.%s.%s', $kind, hash('xxh128', implode('|', $parts)));
    }
}
