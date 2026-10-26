<?php

declare(strict_types=1);

namespace App\Domain\Event\Http;

use App\Address\Model\Address;
use App\Domain\Event\EventDayCount;
use App\Domain\Event\EventVenue;
use App\Entity\Event;
use DateTimeZone;

final class EventSerialiser
{
    /** @return array{id: string, organisationId: string, name: string, status: string, startsAt: string, endsAt: string, timeZone: string, dayCount: int, currency: string, venue: ?array{name: ?string, address: ?array{formatted: string, line1: ?string, line2: ?string, city: ?string, region: ?string, postalCode: ?string, countryCode: ?string, latitude: ?float, longitude: ?float}}, createdAt: string} */
    public static function event(Event $event): array
    {
        $venue = EventVenue::of($event);

        return [
            'id' => $event->getId()->toRfc4122(),
            'organisationId' => $event->getOrganisation()->getId()->toRfc4122(),
            'name' => $event->getName(),
            'status' => $event->getStatus()->value,
            'startsAt' => $event->getStartsAt()->format(\DATE_ATOM),
            'endsAt' => $event->getEndsAt()->format(\DATE_ATOM),
            'timeZone' => $event->getTimeZone(),
            'dayCount' => EventDayCount::of($event->getStartsAt(), $event->getEndsAt(), new DateTimeZone($event->getTimeZone())),
            'currency' => $event->getCurrency(),
            'venue' => null === $venue ? null : ['name' => $venue->name, 'address' => null === $venue->address ? null : self::address($venue->address)],
            'createdAt' => $event->getCreatedAt()->format(\DATE_ATOM),
        ];
    }

    /** @return array{formatted: string, line1: ?string, line2: ?string, city: ?string, region: ?string, postalCode: ?string, countryCode: ?string, latitude: ?float, longitude: ?float} */
    private static function address(Address $address): array
    {
        return [
            'formatted' => $address->formatted,
            'line1' => $address->line1,
            'line2' => $address->line2,
            'city' => $address->city,
            'region' => $address->region,
            'postalCode' => $address->postalCode,
            'countryCode' => $address->countryCode,
            'latitude' => $address->latitude,
            'longitude' => $address->longitude,
        ];
    }
}
