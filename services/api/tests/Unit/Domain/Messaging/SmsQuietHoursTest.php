<?php

declare(strict_types=1);

namespace App\Tests\Unit\Domain\Messaging;

use App\Domain\Messaging\Sms\SmsQuietHours;
use App\Domain\Messaging\Sms\SmsRecipientZoneResolver;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class SmsQuietHoursTest extends TestCase
{
    #[Test]
    public function theWindowOpensAtNineAndClosesAtEight(): void
    {
        $lagos = new DateTimeZone('Africa/Lagos');

        self::assertNull(SmsQuietHours::releaseAt(new DateTimeImmutable('2026-11-27 09:00 Africa/Lagos'), [$lagos]));
        self::assertNull(SmsQuietHours::releaseAt(new DateTimeImmutable('2026-11-27 19:59 Africa/Lagos'), [$lagos]));
        self::assertSame('2026-11-27T08:00:00+00:00', SmsQuietHours::releaseAt(new DateTimeImmutable('2026-11-27 08:59 Africa/Lagos'), [$lagos])?->format(\DATE_ATOM));
        self::assertSame('2026-11-28T08:00:00+00:00', SmsQuietHours::releaseAt(new DateTimeImmutable('2026-11-27 20:00 Africa/Lagos'), [$lagos])?->format(\DATE_ATOM));
    }

    #[Test]
    public function aNightTheClocksChangeStillWaitsForNineByTheNewClock(): void
    {
        $london = new DateTimeZone('Europe/London');

        self::assertSame('2027-03-28T08:00:00+00:00', SmsQuietHours::releaseAt(new DateTimeImmutable('2027-03-27 21:00 Europe/London'), [$london])?->format(\DATE_ATOM));
        self::assertSame('2026-10-25T09:00:00+00:00', SmsQuietHours::releaseAt(new DateTimeImmutable('2026-10-24 21:00 Europe/London'), [$london])?->format(\DATE_ATOM));
    }

    #[Test]
    public function aLosAngelesNumberForANewYorkEventWaitsForNineInLosAngeles(): void
    {
        self::assertSame('2026-11-27T17:00:00+00:00', self::releaseFor('+13105551234', '2026-11-27 09:00 America/New_York', 'America/New_York'));
    }

    #[Test]
    public function aRioNumberGoesByRioTimeWhateverTheEventsZone(): void
    {
        self::assertSame('2026-11-27T12:00:00+00:00', self::releaseFor('+5521987654321', '2026-11-27 09:41 Europe/London', 'Europe/London'));
    }

    #[Test]
    public function aNumberInTwoZonesGoesOnlyWhileTheWindowIsOpenInBoth(): void
    {
        // +1 907 is America/Anchorage and, an hour west of it, America/Adak.
        self::assertSame('2026-11-27T19:00:00+00:00', self::releaseFor('+19075551234', '2026-11-27 09:30 America/Anchorage', 'Europe/London'));
        self::assertNull(self::releaseFor('+19075551234', '2026-11-27 19:59 America/Anchorage', 'Europe/London'));
        self::assertSame('2026-11-28T19:00:00+00:00', self::releaseFor('+19075551234', '2026-11-27 20:00 America/Anchorage', 'Europe/London'));
    }

    #[Test]
    public function aNumberPlacedInNoZoneGoesByTheEvents(): void
    {
        self::assertSame('2026-11-27T08:00:00+00:00', self::releaseFor('+80012345678', '2026-11-27 08:00 Africa/Lagos', 'Africa/Lagos'));
        self::assertNull(self::releaseFor('+80012345678', '2026-11-27 09:00 Africa/Lagos', 'Africa/Lagos'));
    }

    #[Test]
    public function aNumberInZonesTooFarApartGoesByTheEvents(): void
    {
        // A North American toll-free number spans American Samoa to Guam.
        self::assertNull(self::releaseFor('+18005551234', '2026-11-27 09:00 Africa/Lagos', 'Africa/Lagos'));
    }

    private static function releaseFor(string $number, string $due, string $eventZone): ?string
    {
        $now = new DateTimeImmutable($due);

        return SmsQuietHours::releaseAt($now, SmsRecipientZoneResolver::resolve($number, new DateTimeZone($eventZone), $now))?->format(\DATE_ATOM);
    }
}
