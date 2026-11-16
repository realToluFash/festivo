<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow;

use App\Domain\RunOfShow\Model\ItemRun;
use App\Domain\RunOfShow\Model\PressLoss;
use App\Domain\RunOfShow\Model\Replayed;
use App\Entity\ScheduleItem;
use App\Entity\SchedulePress;
use App\Enum\ErrorCode;
use App\Enum\PressKind;
use Psl\Vec;

/** Every item's state from all the event's presses in pressed order (sc-3895), so a late earlier press overturns a later one; one item Now per track. */
final readonly class PressReplay
{
    /**
     * @param list<ScheduleItem>  $items
     * @param list<SchedulePress> $presses in any order
     */
    public static function of(array $items, array $presses): Replayed
    {
        $runs = [];
        $losses = [];
        $trackOf = [];

        foreach ($items as $item) {
            $id = $item->getId()->toRfc4122();
            $runs[$id] = new ItemRun();
            $trackOf[$id] = EventDay::of($item->getStartsAt()) . "\0" . ($item->getPlace() ?? '');
        }

        $now = [];

        foreach (Vec\sort($presses, self::inPressOrder(...)) as $press) {
            $id = $press->getItem()->getId()->toRfc4122();
            $run = $runs[$id] ?? null;

            if (null === $run) {
                continue;
            }

            $track = $trackOf[$id];
            $loss = self::refusal($press, $run, $runs[$now[$track] ?? ''] ?? null);

            if (null !== $loss) {
                $losses[$press->getId()->toRfc4122()] = $loss;

                continue;
            }

            $at = $press->getPressedAt();

            $runs[$id] = match ($press->getKind()) {
                PressKind::Start => new ItemRun(startedAt: $at, startedBy: $press),
                PressKind::Done => new ItemRun($run->startedAt, null !== $run->startedAt && $run->startedAt > $at ? $run->startedAt : $at, false, $run->startedBy, $press),
                PressKind::Skip => new ItemRun(skipped: true, finishedBy: $press),
            };

            if (PressKind::Start === $press->getKind()) {
                $now[$track] = $id;
            } elseif (($now[$track] ?? null) === $id) {
                unset($now[$track]);
            }
        }

        return new Replayed($runs, $losses);
    }

    private static function refusal(SchedulePress $press, ItemRun $run, ?ItemRun $trackNow): ?PressLoss
    {
        if ($run->isOver()) {
            return new PressLoss(ErrorCode::ItemFinished, $run->finishedBy);
        }

        return match ($press->getKind()) {
            PressKind::Start => match (true) {
                null !== $run->startedAt => new PressLoss(ErrorCode::ItemStarted, $run->startedBy),
                null !== $trackNow => new PressLoss(ErrorCode::TrackBusy, $trackNow->startedBy),
                default => null,
            },
            PressKind::Done => null === $run->startedAt ? new PressLoss(ErrorCode::ItemNotStarted, null) : null,
            PressKind::Skip => null,
        };
    }

    private static function inPressOrder(SchedulePress $a, SchedulePress $b): int
    {
        return [$a->getPressedAt(), $a->getIdempotencyKey()] <=> [$b->getPressedAt(), $b->getIdempotencyKey()];
    }
}
