<?php

declare(strict_types=1);

namespace App\Integrations\Nominatim;

use App\Address\Exception\AddressNotFound;
use App\Address\Exception\ProviderUnavailable;
use App\Address\Interfaces\AddressProviderInterface;
use App\Address\Model\Address;
use App\Address\Model\Suggestion;
use JsonException;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final readonly class NominatimProvider implements AddressProviderInterface
{
    public function __construct(
        private HttpClientInterface $httpClient,
        private LoggerInterface $logger,
        private string $endpoint = 'https://nominatim.openstreetmap.org',
        // Identifying yourself is in OpenStreetMap's usage policy. Not decoration.
        private string $userAgent = 'Soirely/1.0 (+https://soirely.com)',
    ) {
    }

    /**
     * @return Type\TypeInterface<array{
     *     display_name: string,
     *     osm_type?: string,
     *     osm_id?: string,
     *     lat?: float,
     *     lon?: float,
     *     address?: array<string, string>,
     * }>
     */
    private static function result(): Type\TypeInterface
    {
        return Type\shape([
            'display_name' => Type\string(),
            'osm_type' => Type\optional(Type\string()),
            'osm_id' => Type\optional(Type\string()),
            'lat' => Type\optional(Type\float()),
            'lon' => Type\optional(Type\float()),
            'address' => Type\optional(Type\dict(Type\string(), Type\string())),
        ]);
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
            $params['countrycodes'] = Str\lowercase($countryCode);
        }

        return Vec\map($this->call('/search', $params), static function (array $r): Suggestion {
            $display = $r['display_name'];

            // Str\search answers ?int. strpos answers int|false, where false and a
            // legitimate 0 are equal under ==.
            $comma = Str\search($display, ',');

            return new Suggestion(
                id: ($r['osm_type'] ?? 'N') . ':' . ($r['osm_id'] ?? ''),
                text: null === $comma ? $display : Str\slice($display, 0, $comma),
                secondaryText: null === $comma ? null : Str\trim(Str\slice($display, $comma + 1)),
            );
        });
    }

    public function resolve(string $id): Address
    {
        [$type, $osmId] = \array_pad(Str\split($id, ':', 2), 2, '');

        if ('' === $osmId || !\ctype_digit($osmId)) {
            throw new AddressNotFound(\sprintf('"%s" is not an address id.', $id));
        }

        $results = $this->call('/lookup', [
            'osm_ids' => Str\uppercase(Str\slice($type, 0, 1)) . $osmId,
            'format' => 'jsonv2',
            'addressdetails' => 1,
        ]);

        $first = $results[0] ?? null;
        if (null === $first) {
            throw new AddressNotFound(\sprintf('No address for "%s".', $id));
        }

        $parts = $first['address'] ?? [];

        return new Address(
            formatted: $first['display_name'],
            line1: $this->line1($parts),
            line2: $parts['suburb'] ?? $parts['neighbourhood'] ?? null,
            city: $parts['city'] ?? $parts['town'] ?? $parts['village'] ?? $parts['municipality'] ?? null,
            region: $parts['state'] ?? $parts['region'] ?? null,
            postalCode: $parts['postcode'] ?? null,
            countryCode: isset($parts['country_code']) ? Str\uppercase($parts['country_code']) : null,
            latitude: $first['lat'] ?? null,
            longitude: $first['lon'] ?? null,
        );
    }

    /**
     * @param array<string, string|int> $params
     *
     * @return list<array{
     *     display_name: string,
     *     osm_type?: string,
     *     osm_id?: string,
     *     lat?: float,
     *     lon?: float,
     *     address?: array<string, string>,
     * }>
     *
     * @throws ProviderUnavailable
     */
    private function call(string $path, array $params): array
    {
        try {
            $response = $this->httpClient->request('GET', $this->endpoint . $path, [
                'query' => $params,
                'headers' => ['User-Agent' => $this->userAgent, 'Accept' => 'application/json'],
                'timeout' => 5,
            ]);

            if ($response->getStatusCode() >= 400) {
                throw new ProviderUnavailable(\sprintf('Provider answered %d.', $response->getStatusCode()));
            }

            $decoded = $response->toArray(false);
            $list = \array_is_list($decoded) ? $decoded : [$decoded];

            return Type\vec(self::result())->coerce($list);
        } catch (ProviderUnavailable $e) {
            $this->logger->warning('Address provider failed', ['exception' => $e]);
            throw $e;
        } catch (ExceptionInterface|Type\Exception\CoercionException|JsonException $e) {
            $this->logger->warning('Address provider failed', ['exception' => $e]);

            throw new ProviderUnavailable('The address provider could not be reached.', 0, $e);
        }
    }

    /** @param array<string, string> $parts */
    private function line1(array $parts): ?string
    {
        $number = $parts['house_number'] ?? null;
        $road = $parts['road'] ?? null;

        if (null === $road) {
            return $number;
        }

        return null === $number ? $road : \sprintf('%s %s', $number, $road);
    }
}
