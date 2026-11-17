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
            $trackOf[$id] = self::track($item);
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

    /**
     * Whether a press, replayed at its time, would change any other item on its track: the press it would have
     * overturned or revived first, as the loss it is refused with (sc-3895, 17 Nov). Null when it reaches no further than its own item.
     *
     * @param list<ScheduleItem>  $items
     * @param list<SchedulePress> $presses the standing ones, the new press among them
     */
    public static function overreach(array $items, array $presses, SchedulePress $press): ?PressLoss
    {
        $without = self::of($items, Vec\filter($presses, static fn (SchedulePress $other): bool => $other !== $press));
        $with = self::of($items, $presses);
        $own = $press->getItem();
        $track = self::track($own);
        $changed = [];

        foreach ($items as $item) {
            $id = $item->getId()->toRfc4122();

            if ($item !== $own && self::track($item) === $track && !self::sameRun($without->runs[$id], $with->runs[$id])) {
                $changed[$id] = true;
            }
        }

        if ([] === $changed) {
            return null;
        }

        foreach (Vec\sort($presses, self::inPressOrder(...)) as $other) {
            $key = $other->getId()->toRfc4122();

            if (isset($changed[$other->getItem()->getId()->toRfc4122()]) && ($without->losses[$key] ?? null)?->code !== ($with->losses[$key] ?? null)?->code) {
                return new PressLoss(ErrorCode::TrackBusy, $other);
            }
        }

        return new PressLoss(ErrorCode::TrackBusy, null);
    }

    private static function track(ScheduleItem $item): string
    {
        return EventDay::of($item->getStartsAt()) . "\0" . ($item->getPlace() ?? '');
    }

    private static function sameRun(ItemRun $a, ItemRun $b): bool
    {
        return $a->startedAt?->format('Uv') === $b->startedAt?->format('Uv') && $a->endedAt?->format('Uv') === $b->endedAt?->format('Uv') && $a->skipped === $b->skipped;
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
