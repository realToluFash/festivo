<?php

declare(strict_types=1);

namespace App\Address;

use App\Address\Exception\AddressNotFound;
use App\Address\Exception\ProviderUnavailable;
use App\Address\Interfaces\AddressProviderInterface;
use App\Address\Model\Address;
use App\Address\Model\Suggestion;
use Psl\Str;
use Psl\Vec;
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

                return $this->distinct($this->addressProvider->suggest($trimmed, $countryCode));
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

    /** The address a lookup already resolved, without asking the provider: a save never waits on it or spends its budget. */
    public function resolved(string $id): ?Address
    {
        return $this->cache->get(
            $this->key('resolve', $id),
            static function (ItemInterface $item, bool &$save): ?Address {
                $save = false;

                return null;
            },
        );
    }

    /**
     * Two rows that read the same are one choice offered twice, so the one the provider ranked higher stays.
     *
     * @param list<Suggestion> $suggestions
     *
     * @return list<Suggestion>
     */
    private function distinct(array $suggestions): array
    {
        return Vec\unique_by(
            $suggestions,
            static fn (Suggestion $suggestion): array => [
                Str\lowercase(Str\trim($suggestion->text)),
                null === $suggestion->secondaryText ? null : Str\lowercase(Str\trim($suggestion->secondaryText)),
            ],
        );
    }

    private function key(string $kind, string ...$parts): string
    {
        return \sprintf('address.%s.%s', $kind, \hash('xxh128', \implode('|', $parts)));
    }
}
