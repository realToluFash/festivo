<?php

declare(strict_types=1);

namespace App\Address;

use JsonException;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
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
 *
 * Every response is coerced through RESULT before anything reads a field. A
 * provider's payload is input like any other, and the version of this class
 * that cast its way through `(string) ($r['display_name'] ?? '')` could not
 * tell a missing field from an empty one — so a provider quietly renaming a key
 * produced addresses with blank lines rather than an error anybody would see.
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

    /**
     * What we read out of a result, and nothing else.
     *
     * Declared as the shapes Nominatim actually sends rather than the ones that
     * would be convenient: `osm_id` arrives as a number and is coerced to a
     * string because it is half of an opaque id, and `lat`/`lon` arrive as
     * strings and are coerced to floats because they are coordinates. Getting
     * that the wrong way round is how an id stops round-tripping.
     *
     * The address component keys vary by country — a Japanese result carries
     * keys a British one never does — so that is a dictionary, not a shape.
     *
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
            // Required, unlike the rest. Nominatim always sends it, and making
            // it optional is what let the previous version read a renamed key
            // as a blank address line instead of as an error.
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

            // Str\search answers ?int. strpos answers int|false, where the
            // false and the legitimate 0 are the same value under ==, which is
            // the single most reliable way to misread a PHP string.
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
        [$type, $osmId] = array_pad(Str\split($id, ':', 2), 2, '');

        if ('' === $osmId || !ctype_digit($osmId)) {
            throw new AddressNotFound(sprintf('"%s" is not an address id.', $id));
        }

        $results = $this->call('/lookup', [
            'osm_ids' => Str\uppercase(Str\slice($type, 0, 1)) . $osmId,
            'format' => 'jsonv2',
            'addressdetails' => 1,
        ]);

        $first = $results[0] ?? null;
        if (null === $first) {
            throw new AddressNotFound(sprintf('No address for "%s".', $id));
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
            $response = $this->http->request('GET', $this->endpoint . $path, [
                'query' => $params,
                'headers' => ['User-Agent' => $this->userAgent, 'Accept' => 'application/json'],
                'timeout' => 5,
            ]);

            if ($response->getStatusCode() >= 400) {
                throw new ProviderUnavailable(sprintf('Provider answered %d.', $response->getStatusCode()));
            }

            // `/search` answers a list and `/lookup` answers a single object.
            $decoded = $response->toArray(false);
            $list = array_is_list($decoded) ? $decoded : [$decoded];

            return Type\vec(self::result())->coerce($list);
        } catch (ProviderUnavailable $e) {
            $this->logger->warning('Address provider failed', ['exception' => $e]);
            throw $e;
        } catch (ExceptionInterface|Type\Exception\CoercionException|JsonException $e) {
            // A payload we cannot read is the provider being unusable, not the
            // address being absent. The caller must be able to tell those apart:
            // one means "type it yourself", the other means "no such place".
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

        return null === $number ? $road : sprintf('%s %s', $number, $road);
    }
}
