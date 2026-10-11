<?php

declare(strict_types=1);

namespace App\Address;

use JsonException;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * OpenStreetMap's geocoder.
 *
 * Chosen as the first adapter because it needs no key, which means the whole
 * path can be developed and tested without an account — the same reason the
 * mail and SMS sinks exist. A commercial provider is another class behind the
 * same interface.
 *
 * It has a published usage policy that includes identifying yourself, so the
 * User-Agent is deliberate rather than decoration.
 */
final readonly class NominatimProvider implements AddressProvider
{
    public function __construct(
        private HttpClientInterface $http,
        private LoggerInterface $logger,
        private string $endpoint = 'https://nominatim.openstreetmap.org',
        private string $userAgent = 'Soirely/1.0 (+https://soirely.com)',
    ) {
    }

    public function suggest(string $query, ?string $countryCode = null): array
    {
        $params = [
            'q' => $query,
            'format' => 'jsonv2',
            'addressdetails' => 1,
            'limit' => 8,
        ];

        if (null !== $countryCode && '' !== $countryCode) {
            $params['countrycodes'] = strtolower($countryCode);
        }

        $results = $this->call('/search', $params);

        return array_values(array_map(
            static function (array $r): Suggestion {
                $display = (string) ($r['display_name'] ?? '');
                $comma = strpos($display, ',');

                return new Suggestion(
                    id: (string) ($r['osm_type'] ?? 'N') . ':' . (string) ($r['osm_id'] ?? ''),
                    text: false === $comma ? $display : substr($display, 0, $comma),
                    secondaryText: false === $comma ? null : trim(substr($display, $comma + 1)),
                );
            },
            $results,
        ));
    }

    public function resolve(string $id): Address
    {
        [$type, $osmId] = array_pad(explode(':', $id, 2), 2, '');

        if ('' === $osmId || !ctype_digit($osmId)) {
            throw new AddressNotFound(sprintf('"%s" is not an address id.', $id));
        }

        $results = $this->call('/lookup', [
            'osm_ids' => strtoupper(substr($type, 0, 1)) . $osmId,
            'format' => 'jsonv2',
            'addressdetails' => 1,
        ]);

        $first = $results[0] ?? null;
        if (null === $first) {
            throw new AddressNotFound(sprintf('No address for "%s".', $id));
        }

        $parts = $first['address'] ?? [];

        return new Address(
            formatted: (string) ($first['display_name'] ?? ''),
            line1: $this->line1($parts),
            line2: $parts['suburb'] ?? $parts['neighbourhood'] ?? null,
            city: $parts['city'] ?? $parts['town'] ?? $parts['village'] ?? $parts['municipality'] ?? null,
            region: $parts['state'] ?? $parts['region'] ?? null,
            postalCode: $parts['postcode'] ?? null,
            countryCode: isset($parts['country_code']) ? strtoupper((string) $parts['country_code']) : null,
            latitude: isset($first['lat']) ? (float) $first['lat'] : null,
            longitude: isset($first['lon']) ? (float) $first['lon'] : null,
        );
    }

    /** @param array<string, string|int> $params @return list<array<string, mixed>> */
    private function call(string $path, array $params): array
    {
        try {
            $response = $this->http->request('GET', $this->endpoint . $path, [
                'query' => $params,
                'headers' => ['User-Agent' => $this->userAgent, 'Accept' => 'application/json'],
                'timeout' => 5,
            ]);

            if ($response->getStatusCode() >= 400) {
                throw new ProviderUnavailable(sprintf('Provider answered %d.', $response->getStatusCode()));
            }

            $decoded = $response->toArray(false);

            return array_is_list($decoded) ? $decoded : [$decoded];
        } catch (ProviderUnavailable $e) {
            $this->logger->warning('Address provider failed', ['exception' => $e]);
            throw $e;
        } catch (ExceptionInterface|JsonException $e) {
            $this->logger->warning('Address provider failed', ['exception' => $e]);
            throw new ProviderUnavailable('The address provider could not be reached.', 0, $e);
        }
    }

    /** @param array<string, mixed> $parts */
    private function line1(array $parts): ?string
    {
        $number = $parts['house_number'] ?? null;
        $road = $parts['road'] ?? null;

        if (null === $road) {
            return null === $number ? null : (string) $number;
        }

        return null === $number ? (string) $road : sprintf('%s %s', $number, $road);
    }
}
