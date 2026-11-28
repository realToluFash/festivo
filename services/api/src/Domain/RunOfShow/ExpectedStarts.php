<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow;

use App\Domain\Event\LocalTimeResolver;
use App\Entity\ScheduleItem;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Dict;
use Psl\Math;
use Psl\Vec;

/** When each item starts as the run view works it out (sc-1404), on the server so the guest's page needs no item it does not show: packages/domain's runTrack, which the run view uses, must agree with it. */
final class ExpectedStarts
{
    private const int MINUTE = 60;

    private const int ROUNDED_TO_MINUTES = 5;

    /**
     * @param list<ScheduleItem> $items
     *
     * @return array<string, DateTimeImmutable> by item id
     */
    public static function of(array $items, DateTimeImmutable $now, DateTimeZone $zone): array
    {
        $today = EventDay::of(new DateTimeImmutable($now->setTimezone($zone)->format('Y-m-d H:i'), new DateTimeZone('UTC')));
        $tracks = Dict\group_by($items, static fn (ScheduleItem $item): string => EventDay::of($item->getStartsAt()) . "\0" . ($item->getPlace() ?? ''));
        $starts = [];

        foreach ($tracks as $track) {
            $expected = EventDay::of($track[0]->getStartsAt()) === $today ? self::track($track, $now, $zone) : [];

            foreach ($track as $item) {
                $id = $item->getId()->toRfc4122();
                $starts[$id] = $item->getStartedAt()
                    ?? (isset($expected[$id]) ? new DateTimeImmutable('@' . ($expected[$id] * self::MINUTE)) : self::planned($item, $zone));
            }
        }

        return $starts;
    }

    /** By the event's own clock, so 17:24 reads 17:20 in a zone whose offset is not whole hours too; the guest's page and the room screen both round so. */
    public static function roundedDown(DateTimeImmutable $moment, DateTimeZone $zone): DateTimeImmutable
    {
        $zoned = $moment->setTimezone($zone);
        $over = ((int) $zoned->format('i')) % self::ROUNDED_TO_MINUTES * 60 + (int) $zoned->format('s');

        return $zoned->setTimestamp($zoned->getTimestamp() - $over);
    }

    public static function planned(ScheduleItem $item, DateTimeZone $zone): DateTimeImmutable
    {
        return LocalTimeResolver::resolve($item->getStartsAt(), $zone);
    }

    /**
     * @param list<ScheduleItem> $track
     *
     * @return array<string, int> the expected start of each item not yet started
     */
    private static function track(array $track, DateTimeImmutable $now, DateTimeZone $zone): array
    {
        $at = self::minutes($now);
        $planned = static fn (ScheduleItem $item): int => self::minutes(self::planned($item, $zone));
        $ordered = Vec\sort($track, static fn (ScheduleItem $a, ScheduleItem $b): int => $planned($a) <=> $planned($b));
        $lastStarted = -1;

        foreach ($ordered as $index => $item) {
            if (null !== $item->getStartedAt()) {
                $lastStarted = $index;
            }
        }

        $end = \PHP_INT_MIN;
        $starts = [];

        foreach ($ordered as $index => $item) {
            $length = $item->getLengthMinutes() ?? 0;
            $startedAt = $item->getStartedAt();
            $endedAt = $item->getEndedAt();

            if ($item->isSkipped()) {
                continue;
            }

            if (null !== $endedAt) {
                $end = self::minutes($endedAt);

                continue;
            }

            if (null !== $startedAt) {
                $end = Math\maxva(self::minutes($startedAt) + $length, $at);

                continue;
            }

            $start = $item->isFixedTime() ? $planned($item) : Math\maxva($planned($item), $end, $at);
            $starts[$item->getId()->toRfc4122()] = $start;

            if ($index > $lastStarted) {
                $end = $start + $length;
            }
        }

        return $starts;
    }

    private static function minutes(DateTimeImmutable $moment): int
    {
        return Math\div($moment->getTimestamp(), self::MINUTE);
    }
}
