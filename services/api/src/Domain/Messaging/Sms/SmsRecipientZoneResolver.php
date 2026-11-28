<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Sms;

use DateTimeImmutable;
use DateTimeZone;
use libphonenumber\NumberParseException;
use libphonenumber\PhoneNumberToTimeZonesMapper;
use libphonenumber\PhoneNumberUtil;
use Psl\Math;
use Psl\Vec;

final readonly class SmsRecipientZoneResolver
{
    /**
     * @return non-empty-list<DateTimeZone> every zone the number's own prefix may place it in, or the event's alone when
     *                                      it places it in none, or in zones no hour of the window is open in all of
     */
    public static function resolve(string $number, DateTimeZone $eventZone, DateTimeImmutable $now): array
    {
        try {
            $parsed = PhoneNumberUtil::getInstance()->parse($number);
        } catch (NumberParseException) {
            return [$eventZone];
        }

        $zones = Vec\map(
            Vec\filter(
                PhoneNumberToTimeZonesMapper::getInstance()->getTimeZonesForNumber($parsed),
                static fn (string $name): bool => PhoneNumberToTimeZonesMapper::UNKNOWN_TIMEZONE !== $name,
            ),
            static fn (string $name): DateTimeZone => new DateTimeZone($name),
        );

        if ([] === $zones) {
            return [$eventZone];
        }

        $offsets = Vec\map($zones, static fn (DateTimeZone $zone): int => $zone->getOffset($now));
        $window = (SmsQuietHours::CLOSES - SmsQuietHours::OPENS) * 3600;

        return Math\max($offsets) - Math\min($offsets) >= $window ? [$eventZone] : $zones;
    }
}
