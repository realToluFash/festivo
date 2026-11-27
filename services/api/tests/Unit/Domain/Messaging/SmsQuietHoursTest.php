<?php

declare(strict_types=1);

namespace App\Tests\Unit\Domain\Messaging;

use App\Domain\Messaging\Sms\SmsQuietHours;
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

        self::assertNull(SmsQuietHours::releaseAt(new DateTimeImmutable('2026-11-27 09:00 Africa/Lagos'), $lagos));
        self::assertNull(SmsQuietHours::releaseAt(new DateTimeImmutable('2026-11-27 19:59 Africa/Lagos'), $lagos));
        self::assertSame('2026-11-27T08:00:00+00:00', SmsQuietHours::releaseAt(new DateTimeImmutable('2026-11-27 08:59 Africa/Lagos'), $lagos)?->format(\DATE_ATOM));
        self::assertSame('2026-11-28T08:00:00+00:00', SmsQuietHours::releaseAt(new DateTimeImmutable('2026-11-27 20:00 Africa/Lagos'), $lagos)?->format(\DATE_ATOM));
    }

    #[Test]
    public function aNightTheClocksChangeStillWaitsForNineByTheNewClock(): void
    {
        $london = new DateTimeZone('Europe/London');

        self::assertSame('2027-03-28T08:00:00+00:00', SmsQuietHours::releaseAt(new DateTimeImmutable('2027-03-27 21:00 Europe/London'), $london)?->format(\DATE_ATOM));
        self::assertSame('2026-10-25T09:00:00+00:00', SmsQuietHours::releaseAt(new DateTimeImmutable('2026-10-24 21:00 Europe/London'), $london)?->format(\DATE_ATOM));
    }
}
