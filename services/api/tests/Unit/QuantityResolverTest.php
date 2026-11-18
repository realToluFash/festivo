<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Budget\Model\QuantityFacts;
use App\Domain\Budget\QuantityResolver;
use App\Enum\CostBasis;
use App\Enum\QuantitySource;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class QuantityResolverTest extends TestCase
{
    /** @return iterable<string, array{CostBasis, QuantityFacts, int, QuantitySource, ?string}> */
    public static function answers(): iterable
    {
        $known = new QuantityFacts(onList: 200, accepted: 163, seatingTables: 17, staffHours: 63, eventDays: 2);
        $empty = new QuantityFacts(onList: 0, accepted: 0, seatingTables: null, staffHours: null, eventDays: 1);

        yield 'a head is an accepted guest' => [CostBasis::PerHead, $known, 163, QuantitySource::Accepted, null];
        yield 'nobody on the list is zero with its reason' => [CostBasis::PerHead, $empty, 0, QuantitySource::Accepted, QuantityResolver::NO_GUESTS];
        yield 'guests with nobody accepted yet is zero with its own reason' => [CostBasis::PerHead, new QuantityFacts(40, 0, null, null, 1), 0, QuantitySource::Accepted, QuantityResolver::NONE_ACCEPTED];
        yield 'a table is one in the seating plan' => [CostBasis::PerTable, $known, 17, QuantitySource::SeatingTables, null];
        yield 'no seating plan is zero with its reason' => [CostBasis::PerTable, $empty, 0, QuantitySource::SeatingTables, QuantityResolver::NO_SEATING_PLAN];
        yield 'a plan with no table yet is zero with its reason' => [CostBasis::PerTable, new QuantityFacts(12, 10, 0, null, 1), 0, QuantitySource::SeatingTables, QuantityResolver::NO_TABLES];
        yield 'a staff hour is a scheduled one' => [CostBasis::PerStaffHour, $known, 63, QuantitySource::StaffHours, null];
        yield 'staffing with no hours is zero with its reason' => [CostBasis::PerStaffHour, $empty, 0, QuantitySource::StaffHours, QuantityResolver::NO_STAFF_HOURS];
        yield 'a day is one the event spans' => [CostBasis::PerDay, $known, 2, QuantitySource::EventDays, null];
        yield 'a fixed cost is one' => [CostBasis::Fixed, $known, 1, QuantitySource::Fixed, null];
        yield 'a fixed cost is one on an empty event too' => [CostBasis::Fixed, $empty, 1, QuantitySource::Fixed, null];
    }

    #[Test]
    #[DataProvider('answers')]
    public function eachBasisIsAnsweredFromWhatTheEventKnows(CostBasis $basis, QuantityFacts $facts, int $count, QuantitySource $source, ?string $reason): void
    {
        $quantity = QuantityResolver::resolve($basis, $facts);

        self::assertSame([$count, $source, $reason], [$quantity->count, $quantity->source, $quantity->reason]);
    }
}
