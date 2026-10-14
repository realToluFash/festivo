<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Address\Exception\ProviderUnavailable;
use App\Integrations\Nominatim\NominatimProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Json;
use Psr\Log\NullLogger;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

/**
 * The adapter's boundary, which is the provider's payload.
 *
 * A third party's JSON is input like any other, and the version of this adapter
 * that cast its way through it could not tell a missing field from an empty
 * one. These tests are mostly about the shapes Nominatim actually sends being
 * normalised, and about a payload we cannot read failing where somebody can see
 * it rather than three frames downstream.
 */
final class NominatimProviderTest extends TestCase
{
    /**
     * The point of the shape.
     *
     * A renamed or dropped key is the provider becoming unusable, and it says
     * so here. Previously `(string) ($r['display_name'] ?? '')` turned the same
     * payload into a suggestion with no text, which looks like a thin result
     * rather than a broken integration.
     */
    #[Test]
    public function aPayloadMissingARequiredFieldIsAProviderFailure(): void
    {
        $provider = $this->provider([['osm_type' => 'way', 'osm_id' => 1, 'renamed_display' => 'Somewhere']]);

        $this->expectException(ProviderUnavailable::class);

        $provider->suggest('somewhere');
    }

    /** Coordinates arrive as strings and must not stay strings. */
    #[Test]
    public function stringCoordinatesBecomeFloats(): void
    {
        $provider = $this->provider([[
            'display_name' => '10 Downing Street, London',
            'osm_type' => 'way',
            'osm_id' => 4218305,
            'lat' => '51.5033635',
            'lon' => '-0.1276248',
            'address' => ['house_number' => '10', 'road' => 'Downing Street', 'country_code' => 'gb'],
        ]]);

        $address = $provider->resolve('way:4218305');

        self::assertSame(51.5033635, $address->latitude);
        self::assertSame(-0.1276248, $address->longitude);
    }

    /**
     * And `osm_id` arrives as a number and must not stay one: it is half of an
     * opaque id the client hands straight back to us, so it has to round-trip
     * as text.
     */
    #[Test]
    public function aNumericOsmIdBecomesPartOfAStringId(): void
    {
        $provider = $this->provider([[
            'display_name' => 'London Bridge, London',
            'osm_type' => 'way',
            'osm_id' => 4218305,
        ]]);

        $suggestions = $provider->suggest('london bridge');

        self::assertSame('way:4218305', $suggestions[0]->id);
        self::assertSame('London Bridge', $suggestions[0]->text);
        self::assertSame('London', $suggestions[0]->secondaryText);
    }

    /**
     * A postcode that happens to be all digits decodes as a number in some
     * countries, and every consumer of it expects text.
     */
    #[Test]
    public function aNumericAddressComponentBecomesAString(): void
    {
        $provider = $this->provider([[
            'display_name' => 'Rue de Rivoli, Paris',
            'address' => ['road' => 'Rue de Rivoli', 'postcode' => 75001, 'city' => 'Paris'],
        ]]);

        $address = $provider->resolve('way:1');

        self::assertSame('75001', $address->postalCode);
    }

    /** A name with no comma has no secondary line, rather than an empty one. */
    #[Test]
    public function aNameWithNoCommaHasNoSecondaryLine(): void
    {
        $provider = $this->provider([['display_name' => 'Antarctica']]);

        self::assertNull($provider->suggest('antarctica')[0]->secondaryText);
    }

    #[Test]
    public function aProviderErrorStatusIsAProviderFailure(): void
    {
        $client = new MockHttpClient(new MockResponse('upstream exploded', ['http_code' => 500]));
        $provider = new NominatimProvider($client, new NullLogger());

        $this->expectException(ProviderUnavailable::class);

        $provider->suggest('london');
    }

    /** An id that is not ours never reaches the provider. */
    #[Test]
    public function aMalformedIdIsNotAProviderCall(): void
    {
        $client = new MockHttpClient(static function (): MockResponse {
            self::fail('The provider should not have been called.');
        });

        $this->expectExceptionMessage('is not an address id');

        new NominatimProvider($client, new NullLogger())->resolve('not-an-id');
    }

    /** @param list<array<string, mixed>> $results */
    private function provider(array $results): NominatimProvider
    {
        $client = new MockHttpClient(new MockResponse(
            Json\encode($results),
            ['response_headers' => ['content-type' => 'application/json']],
        ));

        return new NominatimProvider($client, new NullLogger());
    }
}
