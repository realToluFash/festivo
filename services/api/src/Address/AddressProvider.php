<?php

declare(strict_types=1);

namespace App\Address;

/**
 * Whoever actually knows about addresses.
 *
 * One interface and one adapter per provider, so switching is a class and a
 * configuration value rather than a change to every caller. The endpoints
 * above it never learn which provider is behind them.
 */
interface AddressProvider
{
    /** @return list<Suggestion> */
    public function suggest(string $query, ?string $countryCode = null): array;

    /** @throws AddressNotFound */
    public function resolve(string $id): Address;
}
