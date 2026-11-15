<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Address\AddressLookup;
use App\Address\Model\Address;
use App\Domain\Event\Model\Venue;
use Psl\Str;

/** A venue as the form sends it, made into what an event stores (sc-3589). */
final readonly class VenueResolver
{
    public function __construct(
        private AddressLookup $addressLookup,
    ) {
    }

    /**
     * A picked address is the one the client's lookup resolved; one the lookup no longer holds is kept as typed; one sent back unchanged keeps the parts it was saved with.
     *
     * @param array{name?: ?string, address?: ?string, addressId?: ?string}|null $typed
     */
    public function resolve(?array $typed, ?Venue $held): ?Venue
    {
        $name = Str\trim($typed['name'] ?? '');
        $address = Str\trim($typed['address'] ?? '');

        if ('' === $name && '' === $address) {
            return null;
        }

        return new Venue(
            '' === $name ? null : $name,
            '' === $address ? null : $this->address($address, $typed['addressId'] ?? null, $held?->address),
        );
    }

    private function address(string $typed, ?string $id, ?Address $held): Address
    {
        if (null !== $id && '' !== $id) {
            return $this->addressLookup->resolved($id) ?? new Address($typed);
        }

        return null !== $held && $held->formatted === $typed ? $held : new Address($typed);
    }
}
