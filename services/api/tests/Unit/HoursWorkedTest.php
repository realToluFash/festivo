<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Budget\Model\PayRate;
use App\Domain\Budget\StaffCosts;
use App\Domain\Staff\Attendance\HoursWorked;
use App\Enum\HoursMark;
use App\Enum\StaffPay;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class HoursWorkedTest extends TestCase
{
    private const string END = '2027-03-07T00:00:00Z';

    private const string AFTER = '2027-03-07T09:00:00Z';

    #[Test]
    public function aShiftAcrossMidnightCountsFromItsClockInToItsClockOut(): void
    {
        $worked = HoursWorked::of('waiter', 'grace', self::at(self::END), self::at('2027-03-06T15:58:00Z'), self::at('2027-03-07T00:42:00Z'), self::at(self::AFTER));

        self::assertSame([524, 0, null], [$worked->minutes, $worked->assumedMinutes, $worked->mark]);
    }

    #[Test]
    public function aLateClockOutCountsItsRealTime(): void
    {
        $worked = HoursWorked::of('waiter', 'grace', self::at(self::END), self::at('2027-03-06T16:00:00Z'), self::at('2027-03-07T02:12:00Z'), self::at(self::AFTER));

        self::assertSame(612, $worked->minutes);
        self::assertNull($worked->mark);
    }

    #[Test]
    public function aMissingClockOutCountsTheScheduledEndWithItsMark(): void
    {
        $worked = HoursWorked::of('waiter', 'grace', self::at(self::END), self::at('2027-03-06T14:52:00Z'), null, self::at(self::AFTER));

        self::assertSame([548, 548, HoursMark::NotClockedOut], [$worked->minutes, $worked->assumedMinutes, $worked->mark]);
    }

    #[Test]
    public function aMissingClockInCountsNothingWithItsMark(): void
    {
        $worked = HoursWorked::of('waiter', 'emeka', self::at(self::END), null, null, self::at(self::AFTER));

        self::assertSame([0, 0, HoursMark::NoAttendance], [$worked->minutes, $worked->assumedMinutes, $worked->mark]);
        self::assertFalse($worked->worked());
    }

    #[Test]
    public function beforeTheScheduledEndNothingIsMarkedOrAssumed(): void
    {
        $during = self::at('2027-03-06T20:00:00Z');

        self::assertNull(HoursWorked::of('waiter', 'emeka', self::at(self::END), null, null, $during)->mark);
        self::assertSame([0, null], [HoursWorked::of('waiter', 'grace', self::at(self::END), self::at('2027-03-06T15:58:00Z'), null, $during)->minutes, HoursWorked::of('waiter', 'grace', self::at(self::END), self::at('2027-03-06T15:58:00Z'), null, $during)->mark]);
    }

    #[Test]
    public function aFlatFeeAfterTheEventIsOnceForEachPersonWhoWorkedAndNothingForAPlaceNobodyWorked(): void
    {
        $end = self::at(self::END);
        $worked = [
            HoursWorked::of('door', 'tolu', $end, self::at('2027-03-06T15:25:00Z'), self::at('2027-03-06T20:02:00Z'), self::at(self::AFTER)),
            HoursWorked::of('door', 'tolu', $end, self::at('2027-03-06T21:56:00Z'), self::at('2027-03-07T01:10:00Z'), self::at(self::AFTER)),
            HoursWorked::of('mc', 'bayo', $end, null, null, self::at(self::AFTER)),
        ];
        $cost = StaffCosts::pricedWorked(['door', 'mc'], $worked, ['door' => new PayRate(StaffPay::Flat, 12_000), 'mc' => new PayRate(StaffPay::Flat, 50_000)], []);

        self::assertSame([471, 1, 12_000], [$cost->jobs[0]->minutes, $cost->jobs[0]->people, $cost->jobs[0]->costMinor]);
        self::assertSame([0, 0, 1, 0], [$cost->jobs[1]->minutes, $cost->jobs[1]->people, $cost->jobs[1]->noAttendance, $cost->jobs[1]->costMinor]);
        self::assertSame(12_000, $cost->totalMinor);
    }

    #[Test]
    public function anHourlyRateAfterTheEventIsOnTheMinutesClockedAndAnOwnRateOnThatPersonsOwn(): void
    {
        $end = self::at(self::END);
        $worked = [
            HoursWorked::of('waiter', 'grace', $end, self::at('2027-03-06T16:00:00Z'), self::at('2027-03-06T22:00:00Z'), self::at(self::AFTER)),
            HoursWorked::of('waiter', 'kunle', $end, self::at('2027-03-06T16:00:00Z'), null, self::at(self::AFTER)),
        ];
        $cost = StaffCosts::pricedWorked(['waiter'], $worked, ['waiter' => new PayRate(StaffPay::Hourly, 1400)], ['kunle' => new PayRate(StaffPay::Hourly, 1600)]);

        self::assertSame([840, 480, 2], [$cost->jobs[0]->minutes, $cost->jobs[0]->assumedMinutes, $cost->jobs[0]->people]);
        self::assertSame((6 * 1400) + (8 * 1600), $cost->jobs[0]->costMinor);
        self::assertSame(['kunle', 480, 12_800], [$cost->own[0]->person, $cost->own[0]->minutes, $cost->own[0]->costMinor]);
    }

    private static function at(string $instant): DateTimeImmutable
    {
        return new DateTimeImmutable($instant);
    }
}
