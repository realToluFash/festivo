<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Event\EventDayCount;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class EventDayCountTest extends TestCase
{
    /** @return iterable<string, array{string, string, string, int}> */
    public static function spans(): iterable
    {
        yield 'a start equal to the end' => ['Europe/London', '2026-11-14T16:00:00+00:00', '2026-11-14T16:00:00+00:00', 1];
        yield 'morning to night on one date' => ['Africa/Lagos', '2026-11-14T10:00:00+01:00', '2026-11-14T23:00:00+01:00', 1];
        yield 'an evening into the small hours' => ['Africa/Lagos', '2026-11-14T19:00:00+01:00', '2026-11-15T02:00:00+01:00', 2];
        yield 'across a month end' => ['Africa/Lagos', '2026-01-30T14:00:00+01:00', '2026-02-02T12:00:00+01:00', 4];
        yield 'an end of exactly midnight' => ['Africa/Lagos', '2026-11-13T18:00:00+01:00', '2026-11-14T00:00:00+01:00', 1];
        yield 'one minute past midnight' => ['Africa/Lagos', '2026-11-13T18:00:00+01:00', '2026-11-14T00:01:00+01:00', 2];
        yield 'an end at the first instant of a date that skips midnight' => ['America/Santiago', '2026-09-05T18:00:00-04:00', '2026-09-06T01:00:00-03:00', 1];
        yield 'two dates in nearly 50 hours as the clocks go back' => ['Europe/London', '2026-10-24T00:00:00+01:00', '2026-10-25T23:59:00+00:00', 2];
        yield 'three dates in 46 and a half hours as the clocks go forward' => ['Europe/London', '2026-03-28T01:00:00+00:00', '2026-03-30T00:30:00+01:00', 3];
        yield 'January afternoon in London' => ['Europe/London', '2026-01-15T14:00:00+00:00', '2026-01-15T16:00:00+00:00', 1];
        yield 'the same instants in Tokyo' => ['Asia/Tokyo', '2026-01-15T14:00:00+00:00', '2026-01-15T16:00:00+00:00', 2];
    }

    #[Test]
    #[DataProvider('spans')]
    public function itCountsTheDatesTheSpanTouchesInTheEventsZone(string $zone, string $startsAt, string $endsAt, int $expected): void
    {
        self::assertSame($expected, EventDayCount::of(new DateTimeImmutable($startsAt), new DateTimeImmutable($endsAt), new DateTimeZone($zone)));
    }
}
