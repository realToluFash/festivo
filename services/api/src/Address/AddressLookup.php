<?php

declare(strict_types=1);

namespace App\Address;

use App\Address\Exception\AddressNotFound;
use App\Address\Exception\ProviderUnavailable;
use App\Address\Interfaces\AddressProviderInterface;
use App\Address\Model\Address;
use App\Address\Model\Suggestion;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

final readonly class AddressLookup
{
    public const MIN_QUERY_LENGTH = 3;

    public function __construct(
        private AddressProviderInterface $addressProvider,
        private CacheInterface $cache,
        private int $suggestTtlSeconds = 3600,
        private int $resolveTtlSeconds = 86400,
    ) {
    }

    /** @return list<Suggestion> */
    public function suggest(string $query, ?string $countryCode = null): array
    {
        $trimmed = \trim($query);

        if (\mb_strlen($trimmed) < self::MIN_QUERY_LENGTH) {
            return [];
        }

        return $this->cache->get(
            $this->key('suggest', $trimmed, $countryCode ?? ''),
            function (ItemInterface $item) use ($trimmed, $countryCode): array {
                $item->expiresAfter($this->suggestTtlSeconds);

                return $this->addressProvider->suggest($trimmed, $countryCode);
            },
        );
    }

    /** @throws AddressNotFound|ProviderUnavailable */
    public function resolve(string $id): Address
    {
        return $this->cache->get(
            $this->key('resolve', $id),
            function (ItemInterface $item) use ($id): Address {
                $item->expiresAfter($this->resolveTtlSeconds);

                return $this->addressProvider->resolve($id);
            },
        );
    }

    private function key(string $kind, string ...$parts): string
    {
        return \sprintf('address.%s.%s', $kind, \hash('xxh128', \implode('|', $parts)));
    }
}
