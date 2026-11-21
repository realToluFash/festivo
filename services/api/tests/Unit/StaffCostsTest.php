<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Budget\Model\PayRate;
use App\Domain\Budget\Model\ScheduledShift;
use App\Domain\Budget\StaffCosts;
use App\Enum\StaffPay;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Vec;

final class StaffCostsTest extends TestCase
{
    #[Test]
    public function aShiftNeedingThreeWithOnePersonOnItIsThreeTimesItsLength(): void
    {
        $cost = StaffCosts::priced(['waiter'], [new ScheduledShift('waiter', 360, 3, ['sade'])], ['waiter' => new PayRate(StaffPay::Hourly, 1400)], [], []);

        self::assertSame(1080, $cost->scheduledMinutes);
        self::assertSame(25_200, $cost->totalMinor);
    }

    #[Test]
    public function anHourlyCostIsRoundedHalfUpToTheMinorUnitOncePerJob(): void
    {
        $cost = StaffCosts::priced(['bar'], [new ScheduledShift('bar', 25, 1, []), new ScheduledShift('bar', 25, 1, [])], ['bar' => new PayRate(StaffPay::Hourly, 1401)], [], []);

        self::assertSame(1168, $cost->totalMinor);
    }

    #[Test]
    public function aFlatFeeIsOnceForEachPersonAndOnceForEachOpenPlace(): void
    {
        $cost = StaffCosts::priced(
            ['door'],
            [new ScheduledShift('door', 180, 1, ['tolu']), new ScheduledShift('door', 240, 3, ['tolu'])],
            ['door' => new PayRate(StaffPay::Flat, 12_000)],
            [],
            [],
        );

        self::assertSame(3, $cost->jobs[0]->fees);
        self::assertSame(36_000, $cost->totalMinor);
        self::assertSame(['tolu'], $cost->jobs[0]->paidOnce);
    }

    #[Test]
    public function aPersonOnTheirOwnRateIsPaidItAndTheRestAtTheJobs(): void
    {
        $cost = StaffCosts::priced(
            ['waiter'],
            [new ScheduledShift('waiter', 360, 2, ['kunle'])],
            ['waiter' => new PayRate(StaffPay::Hourly, 1400)],
            ['kunle' => new PayRate(StaffPay::Hourly, 1600)],
            ['kunle' => 'waiter'],
        );

        self::assertSame(9600 + 8400, $cost->totalMinor);
        self::assertSame(['kunle'], Vec\map($cost->own, static fn ($own): string => $own->person));
    }

    #[Test]
    public function aJobWithNoRateIsLeftOutWithItsHoursReported(): void
    {
        $cost = StaffCosts::priced(
            ['waiter', 'bar', 'security'],
            [new ScheduledShift('waiter', 60, 1, []), new ScheduledShift('bar', 645, 1, [])],
            ['waiter' => new PayRate(StaffPay::Hourly, 1400), 'security' => new PayRate(StaffPay::Hourly, 1500)],
            [],
            [],
        );

        self::assertSame(1400, $cost->totalMinor);
        self::assertSame(60, $cost->countedMinutes);
        self::assertSame(705, $cost->scheduledMinutes);
        self::assertSame(['bar'], Vec\map($cost->unrated(), static fn ($job): string => $job->job));
        self::assertSame(0, $cost->jobs[2]->costMinor);
    }

    #[Test]
    public function aPersonOnTheirOwnRateWithNoShiftIsStillListedAtNoHours(): void
    {
        $cost = StaffCosts::priced(
            ['waiter'],
            [new ScheduledShift('waiter', 360, 1, [])],
            ['waiter' => new PayRate(StaffPay::Hourly, 1400)],
            ['kunle' => new PayRate(StaffPay::Hourly, 1600)],
            ['kunle' => 'waiter'],
        );

        self::assertSame([['kunle', 'waiter', 0, 0]], Vec\map($cost->own, static fn ($own): array => [$own->person, $own->job, $own->minutes, $own->costMinor]));
        self::assertSame(8400, $cost->totalMinor);
    }
}
