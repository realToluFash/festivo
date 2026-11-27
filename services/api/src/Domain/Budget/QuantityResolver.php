<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\Quantity;
use App\Domain\Budget\Model\QuantityFacts;
use App\Domain\Budget\Model\StaffCost;
use App\Domain\Event\EventDayCount;
use App\Domain\Guest\Headcount\HeadcountCalculator;
use App\Domain\Seating\Numbers\SeatingNumbers;
use App\Entity\Event;
use App\Enum\CostBasis;
use App\Enum\QuantitySource;
use DateTimeZone;
use Psl\Math;

/** The only answer to a basis's quantity (sc-83): a surface asks here, never counting from a guest list it has loaded. */
final readonly class QuantityResolver
{
    public const string NO_GUESTS = 'no_guests';

    public const string NONE_ACCEPTED = 'none_accepted';

    public const string NO_SEATING_PLAN = 'no_seating_plan';

    public const string NO_TABLES = 'no_tables';

    public const string NO_STAFF_HOURS = 'no_staff_hours';

    public function __construct(
        private HeadcountCalculator $headcountCalculator,
        private SeatingNumbers $seatingNumbers,
        private StaffCosts $staffCosts,
    ) {
    }

    public function factsFor(Event $event, ?StaffCost $staff = null): QuantityFacts
    {
        $staff ??= $this->staffCosts->of($event);
        $room = $this->seatingNumbers->of($event);
        $counts = $this->headcountCalculator->forEvents([$event])[$event->getId()->toRfc4122()];

        return new QuantityFacts(
            $counts['onList'],
            $counts['accepted'],
            SeatingNumbers::NO_SEATING_PLAN === $room['reason'] ? null : $room['plan']['tables'],
            0 === $staff->scheduledMinutes ? null : Math\div($staff->scheduledMinutes + 30, 60),
            EventDayCount::of($event->getStartsAt(), $event->getEndsAt(), new DateTimeZone($event->getTimeZone())),
            HeadcountCalculator::ifAllCome($counts),
            $staff->totalMinor,
        );
    }

    public static function resolve(CostBasis $basis, QuantityFacts $facts): Quantity
    {
        return match ($basis) {
            CostBasis::PerHead => match (true) {
                0 === $facts->onList => new Quantity(0, QuantitySource::Accepted, self::NO_GUESTS),
                0 === $facts->accepted => new Quantity(0, QuantitySource::Accepted, self::NONE_ACCEPTED),
                default => new Quantity($facts->accepted, QuantitySource::Accepted),
            },
            CostBasis::PerTable => match ($facts->seatingTables) {
                null => new Quantity(0, QuantitySource::SeatingTables, self::NO_SEATING_PLAN),
                0 => new Quantity(0, QuantitySource::SeatingTables, self::NO_TABLES),
                default => new Quantity($facts->seatingTables, QuantitySource::SeatingTables),
            },
            CostBasis::PerStaffHour => null === $facts->staffHours
                ? new Quantity(0, QuantitySource::StaffHours, self::NO_STAFF_HOURS)
                : new Quantity($facts->staffHours, QuantitySource::StaffHours),
            CostBasis::PerDay => new Quantity($facts->eventDays, QuantitySource::EventDays),
            CostBasis::Fixed => new Quantity(1, QuantitySource::Fixed),
        };
    }
}
