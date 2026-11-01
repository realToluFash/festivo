<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Event\CalendarFeed\FeedTokenRedactor;
use App\Domain\Event\CalendarFeed\ICalendarLines;
use App\Domain\Event\CalendarFeed\TimeZoneDefinition;
use App\Enum\FeedEntryStatus;
use DateTimeImmutable;
use DateTimeZone;
use Monolog\Level;
use Monolog\LogRecord;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Str\Byte;
use Psl\Vec;

/** The pieces of the calendar feed that are rules rather than wiring (sc-3626). */
final class CalendarFeedFormatTest extends TestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string TOKEN = 'Qe4tRw8YuP2aKd7Lx3Vb9Nm1Hz6Jc5GsTq0Wn2Ef4Ab';

    #[Test]
    public function textIsEscapedAsRfc5545Asks(): void
    {
        self::assertSame('Ìrè\, Lagos\; back room\nfloor 2 \\\\ east', ICalendarLines::text("Ìrè, Lagos; back room\nfloor 2 \\ east"));
    }

    #[Test]
    public function aLongLineFoldsAtSeventyFiveOctetsWithoutSplittingALetter(): void
    {
        $line = 'SUMMARY:' . Str\repeat('é', 60);

        $folded = Str\split(ICalendarLines::fold($line), "\r\n");

        self::assertSame($line, Str\join(Vec\map($folded, static fn (string $part): string => Str\strip_prefix($part, ' ')), ''));
        foreach ($folded as $part) {
            self::assertLessThanOrEqual(75, Byte\length($part));
            self::assertTrue(\mb_check_encoding($part, 'UTF-8'));
        }
        self::assertGreaterThan(1, Iter\count($folded));
    }

    #[Test]
    public function aZoneWithClockChangesListsEachOneWithItsOffsets(): void
    {
        $lines = TimeZoneDefinition::lines(new DateTimeZone('Europe/Madrid'), new DateTimeImmutable('2026-10-01T00:00:00Z'), new DateTimeImmutable('2027-04-01T00:00:00Z'));

        self::assertSame([
            'BEGIN:VTIMEZONE', 'TZID:Europe/Madrid',
            'BEGIN:DAYLIGHT', 'DTSTART:20261001T020000', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'END:DAYLIGHT',
            'BEGIN:STANDARD', 'DTSTART:20261025T030000', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'END:STANDARD',
            'BEGIN:DAYLIGHT', 'DTSTART:20270328T020000', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'END:DAYLIGHT',
            'END:VTIMEZONE',
        ], $lines);
    }

    #[Test]
    public function aZoneWithoutClockChangesIsOneStandardTime(): void
    {
        self::assertSame([
            'BEGIN:VTIMEZONE', 'TZID:Africa/Lagos',
            'BEGIN:STANDARD', 'DTSTART:20301113T010000', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0100', 'TZNAME:WAT', 'END:STANDARD',
            'END:VTIMEZONE',
        ], TimeZoneDefinition::lines(new DateTimeZone('Africa/Lagos'), new DateTimeImmutable('2030-11-13T00:00:00Z'), new DateTimeImmutable('2030-11-16T00:00:00Z')));
    }

    #[Test]
    public function aCancellationStaysThirtyDaysAndIsThenDropped(): void
    {
        $now = new DateTimeImmutable('2030-11-01T12:00:00Z');
        $startsAt = new DateTimeImmutable('2030-12-01T18:00:00Z');

        self::assertSame(FeedEntryStatus::Confirmed, FeedEntryStatus::of(null, null, $startsAt, $now));
        self::assertSame(FeedEntryStatus::Confirmed, FeedEntryStatus::of(null, new DateTimeImmutable('2030-12-01T20:00:00Z'), $startsAt, $now), 'ended after its start is not called off');
        self::assertSame(FeedEntryStatus::Cancelled, FeedEntryStatus::of(null, new DateTimeImmutable('2030-10-02T12:00:01Z'), $startsAt, $now), 'called off just under 30 days ago');
        self::assertNull(FeedEntryStatus::of(null, new DateTimeImmutable('2030-10-02T12:00:00Z'), $startsAt, $now), 'called off 30 days ago to the second');
        self::assertSame(FeedEntryStatus::Cancelled, FeedEntryStatus::of(new DateTimeImmutable('2030-10-15T00:00:00Z'), null, $startsAt, $now), 'deleted');
        self::assertNull(FeedEntryStatus::of(new DateTimeImmutable('2030-10-01T00:00:00Z'), null, $startsAt, $now), 'deleted over 30 days ago');
    }

    #[Test]
    public function theTokenIsTakenOutOfEveryLogRecord(): void
    {
        $path = '/api/calendar-feeds/' . self::TOKEN . '.ics';
        $record = new LogRecord(new DateTimeImmutable(), 'request', Level::Info, 'Matched route "calendar_feed". GET http://api' . $path, [
            'route' => 'calendar_feed',
            'route_parameters' => ['_route' => 'calendar_feed', '_controller' => 'x', 'token' => self::TOKEN],
            'request_uri' => 'http://api' . $path,
            'method' => 'GET',
        ], ['url' => $path]);

        $redacted = new FeedTokenRedactor()($record);

        self::assertStringNotContainsString(self::TOKEN, $redacted->message . Json\encode($redacted->context) . Json\encode($redacted->extra));
        self::assertSame('http://api/api/calendar-feeds/[redacted].ics', $redacted->context['request_uri']);
        // @mago-expect lint:no-literal-password the redacted route parameter, not a token
        self::assertSame(['_route' => 'calendar_feed', '_controller' => 'x', 'token' => '[redacted]'], $redacted->context['route_parameters']);
    }

    #[Test]
    public function anotherRoutesTokenIsLeftAlone(): void
    {
        // @mago-expect lint:no-literal-password a route parameter named token, not a token
        $record = new LogRecord(new DateTimeImmutable(), 'request', Level::Info, 'Matched route', ['route_parameters' => ['_route' => 'join', 'token' => 'abc']]);

        // @mago-expect lint:no-literal-password a route parameter named token, not a token
        self::assertSame(['_route' => 'join', 'token' => 'abc'], new FeedTokenRedactor()($record)->context['route_parameters']);
    }
}
