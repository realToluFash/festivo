<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Staff\ShiftClock;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Enum\EventType;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Type;

final class ShiftClockTest extends TestCase
{
    /** @return iterable<string, array{string, string, int}> */
    public static function shifts(): iterable
    {
        yield 'an evening' => ['2027-06-12T18:00', '2027-06-12T23:00', 5 * 3600];
        yield 'across midnight' => ['2027-06-12T18:00', '2027-06-13T00:30', 6 * 3600 + 1800];
        yield 'across midnight as the clocks go back' => ['2026-10-24T22:00', '2026-10-25T04:00', 7 * 3600];
        yield 'across midnight as the clocks go forward' => ['2027-03-27T22:00', '2027-03-28T04:00', 5 * 3600];
    }

    #[Test]
    #[DataProvider('shifts')]
    public function aShiftsLengthIsTheTimeBetweenItsWallClockTimesOnTheEventsClock(string $from, string $to, int $seconds): void
    {
        self::assertSame($seconds, ShiftClock::seconds(self::wall($from), self::wall($to), self::event()));
    }

    private static function wall(string $typed): DateTimeImmutable
    {
        return Type\instance_of(DateTimeImmutable::class)->coerce(ShiftClock::wall($typed));
    }

    private static function event(): Event
    {
        $organisation = new Organisation('Bloom Events', 'GB', 'GBP', 'Europe/London', 'hello@bloom.events', 'en');
        $london = new DateTimeZone('Europe/London');

        return new Event($organisation, 'Summer wedding', EventType::Wedding, new DateTimeImmutable('2026-10-24T14:00', $london), new DateTimeImmutable('2026-10-25T06:00', $london), 'GBP');
    }
}
