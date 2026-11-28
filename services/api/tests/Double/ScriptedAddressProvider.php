<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Address\Exception\AddressNotFound;
use App\Address\Exception\ProviderUnavailable;
use App\Address\Interfaces\AddressProviderInterface;
use App\Address\Model\Address;
use App\Address\Model\Suggestion;
use Psl\Str;

/** No test reaches OpenStreetMap: a test publishes the address it means to be found, or takes the lookup down. */
final class ScriptedAddressProvider implements AddressProviderInterface
{
    /** @var array<string, Address> */
    private array $addresses = [];

    private bool $down = false;

    public function publish(string $id, Address $address): void
    {
        $this->addresses[$id] = $address;
    }

    public function takeDown(): void
    {
        $this->down = true;
    }

    public function suggest(string $query, ?string $countryCode = null): array
    {
        $this->answer();

        $found = [];

        foreach ($this->addresses as $id => $address) {
            if (Str\contains_ci($address->formatted, $query)) {
                $parts = Str\split($address->formatted, ', ', 2);
                $found[] = new Suggestion($id, $parts[0], $parts[1] ?? null);
            }
        }

        return $found;
    }

    public function resolve(string $id): Address
    {
        $this->answer();

        return $this->addresses[$id] ?? throw new AddressNotFound(Str\format('No address for "%s".', $id));
    }

    private function answer(): void
    {
        if ($this->down) {
            throw new ProviderUnavailable('Taken down by the test.');
        }
    }
}
