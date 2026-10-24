<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Address\Interfaces\AddressProviderInterface;
use App\Address\Model\Address;
use App\Address\Model\Suggestion;
use Throwable;

final class CountingAddressProvider implements AddressProviderInterface
{
    public int $suggestCalls = 0;

    public int $resolveCalls = 0;

    public function __construct(
        private readonly ?Throwable $suggestThrows = null,
        private readonly ?Throwable $resolveThrows = null,
    ) {
    }

    public function suggest(string $query, ?string $countryCode = null): array
    {
        ++$this->suggestCalls;

        if (null !== $this->suggestThrows) {
            throw $this->suggestThrows;
        }

        return [new Suggestion('node:1', $query)];
    }

    public function resolve(string $id): Address
    {
        ++$this->resolveCalls;

        if (null !== $this->resolveThrows) {
            throw $this->resolveThrows;
        }

        return new Address('somewhere');
    }
}
