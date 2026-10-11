<?php

declare(strict_types=1);

namespace App\Address;

/**
 * A resolved address.
 *
 * Structured components alongside the formatted line, because a venue needs a
 * country for its timezone and currency defaults, and coordinates for a map —
 * none of which can be recovered from a single string.
 */
final readonly class Address
{
    public function __construct(
        public string $formatted,
        public ?string $line1 = null,
        public ?string $line2 = null,
        public ?string $city = null,
        public ?string $region = null,
        public ?string $postalCode = null,
        public ?string $countryCode = null,
        public ?float $latitude = null,
        public ?float $longitude = null,
    ) {
    }

    /** @return array<string, string|float|null> */
    public function toArray(): array
    {
        return [
            'formatted' => $this->formatted,
            'line1' => $this->line1,
            'line2' => $this->line2,
            'city' => $this->city,
            'region' => $this->region,
            'postal_code' => $this->postalCode,
            'country_code' => $this->countryCode,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
        ];
    }
}
