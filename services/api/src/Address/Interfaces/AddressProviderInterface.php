<?php

declare(strict_types=1);

namespace App\Address\Interfaces;

use App\Address\Exception\AddressNotFound;
use App\Address\Model\Address;
use App\Address\Model\Suggestion;

interface AddressProviderInterface
{
    /** @return list<Suggestion> */
    public function suggest(string $query, ?string $countryCode = null): array;

    /** @throws AddressNotFound */
    public function resolve(string $id): Address;
}
