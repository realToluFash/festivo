<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Staff\ShiftClock;
use App\Domain\Staff\ShiftNotice\Model\ShiftTold;
use App\Entity\StaffMember;
use DateInterval;
use DateTimeImmutable;
use Psl\Math;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** A person's notice is urgent within 24 hours of their start (Decided, 19 Oct): the soonest of the shifts they hold and those they were told of, or the event's start when they have none. */
final readonly class ShiftUrgency
{
    private const string WINDOW = 'PT24H';

    public function __construct(
        private ShiftSnapshots $shiftSnapshots,
        private ClockInterface $clock,
    ) {
    }

    public function startOf(StaffMember $entry): DateTimeImmutable
    {
        $event = $entry->getEvent();
        $told = $entry->getTold();
        $shifts = Vec\concat(
            Vec\values(null === $told ? [] : ShiftTold::fromArray($told)->shifts),
            Vec\values($this->shiftSnapshots->of($entry)->shifts),
        );
        $starts = Vec\map($shifts, static fn (array $times): DateTimeImmutable => ShiftClock::instant(ShiftTold::wall($times[0]), $event));

        return Math\min_by($starts, static fn (DateTimeImmutable $start): int => $start->getTimestamp()) ?? $event->getStartsAt();
    }

    public function isUrgent(DateTimeImmutable $start): bool
    {
        return $start <= $this->clock->now()->add(new DateInterval(self::WINDOW));
    }
}
