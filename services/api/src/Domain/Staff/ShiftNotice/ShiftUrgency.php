<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Staff\ShiftClock;
use App\Domain\Staff\ShiftNotice\Model\ShiftTold;
use App\Entity\StaffMember;
use DateInterval;
use DateTimeImmutable;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** A person's notice is urgent within 24 hours of their start: the soonest start still to come among the shifts they were told of and those they hold, judged when it goes (Decided, 26 Nov, on dev3's #97404). */
final readonly class ShiftUrgency
{
    private const string WINDOW = 'PT24H';

    public function __construct(
        private ShiftSnapshots $shiftSnapshots,
        private ClockInterface $clock,
    ) {
    }

    /** @return list<DateTimeImmutable> */
    public function startsOf(StaffMember $entry): array
    {
        $event = $entry->getEvent();
        $told = $entry->getTold();
        $shifts = Vec\concat(
            Vec\values(null === $told ? [] : ShiftTold::fromArray($told)->shifts),
            Vec\values($this->shiftSnapshots->of($entry)->shifts),
        );

        return Vec\map($shifts, static fn (array $times): DateTimeImmutable => ShiftClock::instant(ShiftTold::wall($times[0]), $event));
    }

    /** @param list<DateTimeImmutable> $starts */
    public function isUrgent(array $starts): bool
    {
        $now = $this->clock->now();
        $until = $now->add(new DateInterval(self::WINDOW));

        return Iter\any($starts, static fn (DateTimeImmutable $start): bool => $start > $now && $start <= $until);
    }
}
