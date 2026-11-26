<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Staff\ShiftNotice\Model\ShiftChange;
use App\Domain\Staff\ShiftNotice\Model\ShiftTold;
use App\Enum\ShiftChangeKind;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** Above three shift lines, removals are chosen first, then the soonest (sc-4333, "Decided, 26 Nov (pm): several shifts"). */
final readonly class ShiftChanges
{
    public const int SHIFT_LINES_SHOWN = 3;

    /**
     * @param ?non-negative-int $shown the shift lines named, every one when null, as the roster's Waiting lines have them
     *
     * @return list<ShiftChange>
     */
    public static function between(ShiftTold $told, ShiftTold $now, ?int $shown = self::SHIFT_LINES_SHOWN): array
    {
        $lines = 1 === Iter\count($told->shifts) && 1 === Iter\count($now->shifts)
            ? self::oneShift(Vec\values($told->shifts)[0], Vec\values($now->shifts)[0])
            : self::shifts($told->shifts, $now->shifts, $shown);

        if (null !== $now->job && null !== $told->job && $now->job[0] !== $told->job[0] && [] !== $now->shifts) {
            $lines[] = ShiftChange::value(ShiftChangeKind::Job, $now->job[1], $told->job[1]);
        }

        if ($now->date !== $told->date) {
            $lines[] = ShiftChange::value(ShiftChangeKind::Date, $now->date, $told->date);
        }

        if ($now->venue !== $told->venue && null !== $now->venue && null !== $told->venue) {
            $lines[] = ShiftChange::value(ShiftChangeKind::Venue, $now->venue, $told->venue);
        }

        return $lines;
    }

    /**
     * @param array{0: string, 1: string} $told
     * @param array{0: string, 1: string} $now
     *
     * @return list<ShiftChange>
     */
    private static function oneShift(array $told, array $now): array
    {
        $on = ShiftTold::wall($now[0]);
        $lines = [];

        if ($now[0] !== $told[0]) {
            $lines[] = ShiftChange::time(ShiftChangeKind::StartTime, $on, ShiftTold::wall($told[0]), $on);
        }

        if ($now[1] !== $told[1]) {
            $lines[] = ShiftChange::time(ShiftChangeKind::EndTime, ShiftTold::wall($now[1]), ShiftTold::wall($told[1]), $on);
        }

        return $lines;
    }

    /**
     * @param array<string, array{0: string, 1: string}> $told
     * @param array<string, array{0: string, 1: string}> $now
     * @param ?non-negative-int                          $shown
     *
     * @return list<ShiftChange>
     */
    private static function shifts(array $told, array $now, ?int $shown): array
    {
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
                $others[] = ShiftChange::shift(ShiftChangeKind::ShiftRetimed, ShiftTold::wall($times[0]), ShiftTold::wall($times[1]), ShiftTold::wall($before[0]), ShiftTold::wall($before[1]));
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
}
