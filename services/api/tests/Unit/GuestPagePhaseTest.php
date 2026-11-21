<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\ErrorCode;
use App\Enum\EventStatus;
use App\Enum\GuestPagePhase;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class GuestPagePhaseTest extends TestCase
{
    private const string START = '2026-11-14T16:00:00+01:00';

    private const string END = '2026-11-15T02:00:00+01:00';

    /** @return iterable<string, array{EventStatus, ?string, string, GuestPagePhase}> */
    public static function moments(): iterable
    {
        yield 'live before the start' => [EventStatus::Live, null, '2026-11-14T15:59:59+01:00', GuestPagePhase::Live];
        yield 'happening now' => [EventStatus::Live, null, self::START, GuestPagePhase::Live];
        yield 'paused before the start' => [EventStatus::Paused, null, '2026-11-10T12:00:00+01:00', GuestPagePhase::Paused];
        yield 'paused after the start' => [EventStatus::Paused, null, '2026-11-14T20:00:00+01:00', GuestPagePhase::Paused];
        yield 'paused past its end' => [EventStatus::Paused, null, self::END, GuestPagePhase::Finished];
        yield 'ended before its start' => [EventStatus::Ended, '2026-11-10T12:00:00+01:00', '2026-11-20T12:00:00+01:00', GuestPagePhase::CalledOff];
        yield 'ended after its start' => [EventStatus::Ended, '2026-11-14T20:00:00+01:00', '2026-11-14T21:00:00+01:00', GuestPagePhase::Finished];
        yield 'live past its end' => [EventStatus::Live, null, self::END, GuestPagePhase::Finished];
    }

    #[Test]
    #[DataProvider('moments')]
    public function thePageFollowsTheEventsPhase(EventStatus $status, ?string $endedAt, string $now, GuestPagePhase $phase): void
    {
        self::assertSame($phase, GuestPagePhase::of($status, new DateTimeImmutable(self::START), new DateTimeImmutable(self::END), null === $endedAt ? null : new DateTimeImmutable($endedAt), new DateTimeImmutable($now)));
    }

    #[Test]
    public function aReplyIsRefusedByPhase(): void
    {
        self::assertSame(
            [null, ErrorCode::EventPaused, ErrorCode::EventConcluded, ErrorCode::EventConcluded],
            [GuestPagePhase::Live->refusal(), GuestPagePhase::Paused->refusal(), GuestPagePhase::CalledOff->refusal(), GuestPagePhase::Finished->refusal()],
        );
    }
}
