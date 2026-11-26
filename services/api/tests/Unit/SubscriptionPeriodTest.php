<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Billing\Meter\Model\SubscriptionPeriod;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/** sc-3929: a period runs from the subscription's start to the same moment a month on, the day clamped to the month's last. */
final class SubscriptionPeriodTest extends TestCase
{
    /** @return iterable<string, array{string, string, string, string}> */
    public static function periods(): iterable
    {
        yield 'within the first month' => ['2026-01-31 10:00:00', '2026-02-10 00:00:00', '2026-01-31 10:00:00', '2026-02-28 10:00:00'];
        yield 'February in a leap year' => ['2028-01-31 10:00:00', '2028-02-10 00:00:00', '2028-01-31 10:00:00', '2028-02-29 10:00:00'];
        yield 'the day clamped, then back to the 31st' => ['2026-01-31 10:00:00', '2026-03-05 00:00:00', '2026-02-28 10:00:00', '2026-03-31 10:00:00'];
        yield 'clamped to the 30th' => ['2026-01-31 10:00:00', '2026-04-15 00:00:00', '2026-03-31 10:00:00', '2026-04-30 10:00:00'];
        yield 'one second before the end' => ['2026-11-01 09:00:00', '2026-12-01 08:59:59', '2026-11-01 09:00:00', '2026-12-01 09:00:00'];
        yield 'at the start of the next' => ['2026-11-01 09:00:00', '2026-12-01 09:00:00', '2026-12-01 09:00:00', '2027-01-01 09:00:00'];
        yield 'years on' => ['2024-02-29 12:00:00', '2026-11-30 00:00:00', '2026-11-29 12:00:00', '2026-12-29 12:00:00'];
        yield 'before the start' => ['2026-11-01 09:00:00', '2026-10-20 00:00:00', '2026-11-01 09:00:00', '2026-12-01 09:00:00'];
    }

    #[Test]
    #[DataProvider('periods')]
    public function aMomentFallsInOnePeriod(string $anchor, string $at, string $start, string $end): void
    {
        $period = SubscriptionPeriod::containing(new DateTimeImmutable($anchor), new DateTimeImmutable($at));

        self::assertSame([$start, $end], [$period->start->format('Y-m-d H:i:s'), $period->end->format('Y-m-d H:i:s')]);
    }
}
