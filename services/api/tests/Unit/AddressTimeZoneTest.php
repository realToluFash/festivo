<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Address\AddressTimeZone;
use App\Address\Model\Address;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class AddressTimeZoneTest extends TestCase
{
    #[Test]
    public function aCountryWithOneZoneIsThatZone(): void
    {
        self::assertSame('Africa/Lagos', AddressTimeZone::of(new Address('Victoria Island, Lagos', countryCode: 'NG')));
        self::assertSame('Europe/Paris', AddressTimeZone::of(new Address('Paris', countryCode: 'fr')));
    }

    #[Test]
    public function aCountryWithSeveralIsTheZoneNearestTheAddress(): void
    {
        self::assertSame('Europe/Lisbon', AddressTimeZone::of(new Address('Porto', countryCode: 'PT', latitude: 41.1579, longitude: -8.6291)));
        self::assertSame('Atlantic/Madeira', AddressTimeZone::of(new Address('Funchal', countryCode: 'PT', latitude: 32.6669, longitude: -16.9241)));
        self::assertSame('America/Los_Angeles', AddressTimeZone::of(new Address('San Francisco', countryCode: 'US', latitude: 37.7749, longitude: -122.4194)));
    }

    #[Test]
    public function withoutEnoughToTellThereIsNone(): void
    {
        self::assertNull(AddressTimeZone::of(new Address('12 Bode Thomas Street')));
        self::assertNull(AddressTimeZone::of(new Address('Somewhere in Portugal', countryCode: 'PT')));
        self::assertNull(AddressTimeZone::of(new Address('Nowhere', countryCode: 'XX')));
    }
}
