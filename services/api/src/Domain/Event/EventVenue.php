<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Address\Model\Address;
use App\Domain\Event\Model\Venue;
use App\Entity\Event;

/** An event's venue columns read and written as one (sc-3589). */
final class EventVenue
{
    public static function of(Event $event): ?Venue
    {
        $name = $event->getVenueName();
        $formatted = $event->getVenueAddress();

        if (null === $name && null === $formatted) {
            return null;
        }

        return new Venue($name, null === $formatted ? null : new Address(
            formatted: $formatted,
            line1: $event->getVenueLine1(),
            line2: $event->getVenueLine2(),
            city: $event->getVenueCity(),
            region: $event->getVenueRegion(),
            postalCode: $event->getVenuePostalCode(),
            countryCode: $event->getVenueCountryCode(),
            latitude: $event->getVenueLatitude(),
            longitude: $event->getVenueLongitude(),
        ));
    }

    public static function write(Event $event, ?Venue $venue): void
    {
        $address = $venue?->address;

        $event->setVenue(
            $venue?->name,
            $address?->formatted,
            $address?->line1,
            $address?->line2,
            $address?->city,
            $address?->region,
            $address?->postalCode,
            $address?->countryCode,
            $address?->latitude,
            $address?->longitude,
        );
    }
}
