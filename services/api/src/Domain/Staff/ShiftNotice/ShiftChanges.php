<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Event\WallDays;
use App\Domain\Staff\ShiftNotice\Model\ShiftChange;
use App\Domain\Staff\ShiftNotice\Model\ShiftTold;
use App\Enum\ShiftChangeKind;
use DateTimeImmutable;
use Psl\Dict;
use Psl\Iter;
use Psl\Math;
use Psl\Vec;

/** Above three shift lines, removals are chosen first, then the soonest (sc-4333, "Decided, 26 Nov (pm): several shifts"). */
final readonly class ShiftChanges
{
    public const int SHIFT_LINES_SHOWN = 3;

    private const int DATED_MOVE_DAYS = 7;

    /**
     * @param ?non-negative-int $shown the shift lines named, every one when null, as the roster's Waiting lines have them
     *
     * @return list<ShiftChange>
     */
    public static function between(ShiftTold $told, ShiftTold $now, ?int $shown = self::SHIFT_LINES_SHOWN): array
    {
        $lines = 1 === Iter\count($told->shifts) && 1 === Iter\count($now->shifts)
            ? self::oneShift($told, $now)
            : self::shifts($told, $now, $shown);

        if (null !== $now->job && null !== $told->job && $now->job[0] !== $told->job[0] && [] !== $now->shifts) {
            $lines[] = ShiftChange::value(ShiftChangeKind::Job, $now->job[1], $told->job[1]);
        }

        if ($now->venue !== $told->venue && null !== $now->venue && null !== $told->venue) {
            $lines[] = ShiftChange::value(ShiftChangeKind::Venue, $now->venue, $told->venue);
        }

        return $now->date === $told->date ? $lines : [ShiftChange::value(ShiftChangeKind::Date, $now->date, $told->date), ...$lines];
    }

    /** @return list<ShiftChange> */
    private static function oneShift(ShiftTold $toldOf, ShiftTold $nowOf): array
    {
        $told = Vec\values($toldOf->shifts)[0];
        $now = Vec\values($nowOf->shifts)[0];
        $toldStart = ShiftTold::wall($told[0]);
        $nowStart = ShiftTold::wall($now[0]);
        $on = 0 === WallDays::between($toldStart, $nowStart) ? $nowStart : null;
        $dated = self::isDatedMove($toldStart, $nowStart);
        $lines = [];

        if ($now[0] !== $told[0]) {
            $lines[] = ShiftChange::time(ShiftChangeKind::StartTime, $nowStart, $toldStart, $on, $dated);
        }

        if ($now[1] !== $told[1]) {
            $lines[] = ShiftChange::time(ShiftChangeKind::EndTime, ShiftTold::wall($now[1]), ShiftTold::wall($told[1]), $on, $dated);
        }

        return $lines;
    }

    /**
     * @param ?non-negative-int $shown
     *
     * @return list<ShiftChange>
     */
    private static function shifts(ShiftTold $toldOf, ShiftTold $nowOf, ?int $shown): array
    {
        $told = $toldOf->shifts;
        $now = $nowOf->shifts;
        $removed = Vec\map(
            Dict\diff_by_key($told, $now),
            static fn (array $times): ShiftChange => ShiftChange::shift(ShiftChangeKind::ShiftRemoved, ShiftTold::wall($times[0]), ShiftTold::wall($times[1])),
        );
        $others = [];

        foreach ($now as $id => $times) {
            $before = $told[$id] ?? null;

            if (null === $before) {
                $others[] = ShiftChange::shift(ShiftChangeKind::ShiftAdded, ShiftTold::wall($times[0]), ShiftTold::wall($times[1]));
            } elseif ($before !== $times) {
                $others[] = ShiftChange::shift(ShiftChangeKind::ShiftRetimed, ShiftTold::wall($times[0]), ShiftTold::wall($times[1]), ShiftTold::wall($before[0]), ShiftTold::wall($before[1]), self::isDatedMove(ShiftTold::wall($before[0]), ShiftTold::wall($times[0])));
            }
        }

        $soonest = static fn (ShiftChange $a, ShiftChange $b): int => [$a->start, $a->end] <=> [$b->start, $b->end];
        $chosen = Vec\slice([...Vec\sort($removed, $soonest), ...Vec\sort($others, $soonest)], 0, $shown);
        $lines = Vec\sort($chosen, $soonest);
        $left = Iter\count($removed) + Iter\count($others) - Iter\count($chosen);
        $noneLeft = [] === $now && [] !== $told;

        if (0 < $left && !$noneLeft) {
            $lines[] = ShiftChange::more($left);
        }

        if ($noneLeft) {
            $lines[] = ShiftChange::noShiftLeft();
        }

        return $lines;
    }

    /** A week or more on, a weekday alone could read as the day it left. */
    private static function isDatedMove(DateTimeImmutable $from, DateTimeImmutable $to): bool
    {
        return self::DATED_MOVE_DAYS <= Math\abs(WallDays::between($from, $to));
    }
}
