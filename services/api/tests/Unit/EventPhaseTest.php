<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\EventAction;
use App\Enum\EventPhase;
use App\Enum\EventStatus;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class EventPhaseTest extends TestCase
{
    /** @return iterable<string, array{EventStatus, string, string, string, EventPhase}> */
    public static function moments(): iterable
    {
        $start = '2026-11-14T16:00:00+01:00';
        $end = '2026-11-15T02:00:00+01:00';

        yield 'a second before the start' => [EventStatus::Live, $start, $end, '2026-11-14T15:59:59+01:00', EventPhase::Live];
        yield 'at the start' => [EventStatus::Live, $start, $end, $start, EventPhase::HappeningNow];
        yield 'across midnight' => [EventStatus::Live, $start, $end, '2026-11-15T00:30:00+01:00', EventPhase::HappeningNow];
        yield 'a second before the end' => [EventStatus::Live, $start, $end, '2026-11-15T01:59:59+01:00', EventPhase::HappeningNow];
        yield 'at the end' => [EventStatus::Live, $start, $end, $end, EventPhase::Finished];
        yield 'the second day of three' => [EventStatus::Live, '2026-12-01T10:00:00+01:00', '2026-12-03T18:00:00+01:00', '2026-12-02T09:00:00+01:00', EventPhase::HappeningNow];
        yield 'paused before its end' => [EventStatus::Paused, $start, $end, '2026-11-15T01:59:59+01:00', EventPhase::Paused];
        yield 'paused past its end' => [EventStatus::Paused, $start, $end, $end, EventPhase::Finished];
        yield 'ended before its start' => [EventStatus::Ended, $start, $end, '2026-11-01T12:00:00+01:00', EventPhase::Finished];
        yield 'a draft past its end' => [EventStatus::Draft, $start, $end, '2026-12-01T12:00:00+01:00', EventPhase::Draft];
    }

    #[Test]
    #[DataProvider('moments')]
    public function thePhaseFollowsTheStateAndTheClock(EventStatus $status, string $start, string $end, string $now, EventPhase $phase): void
    {
        self::assertSame($phase, EventPhase::of($status, new DateTimeImmutable($start), new DateTimeImmutable($end), new DateTimeImmutable($now)));
    }

    /** 01:30 happens twice in New York on 1 November 2026; the start is the first, as sc-1486 stores it. */
    #[Test]
    public function aStartInTheRepeatedHourIsTheFirstOne(): void
    {
        $zone = new DateTimeZone('America/New_York');
        $start = new DateTimeImmutable('2026-11-01 01:30', $zone);
        $end = new DateTimeImmutable('2026-11-01 04:00', $zone);
        $at = static fn (string $utc): EventPhase => EventPhase::of(EventStatus::Live, $start, $end, new DateTimeImmutable($utc));

        self::assertSame('2026-11-01T01:30:00-04:00', $start->format(\DATE_ATOM));
        self::assertSame(EventPhase::Live, $at('2026-11-01T05:29:59Z'));
        self::assertSame(EventPhase::HappeningNow, $at('2026-11-01T05:30:00Z'));
        self::assertSame(EventPhase::HappeningNow, $at('2026-11-01T06:29:59Z'), 'the second 01:29:59 is after the start');
        self::assertSame(EventPhase::Finished, $at('2026-11-01T09:00:00Z'));
    }

    #[Test]
    public function aFinishedEventIsEditedButItsScheduleIsNot(): void
    {
        self::assertTrue(EventPhase::Finished->allows(EventAction::Edit));
        self::assertFalse(EventPhase::Finished->allows(EventAction::EditSchedule));
        self::assertFalse(EventPhase::Finished->allows(EventAction::End));
    }
}
