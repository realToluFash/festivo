<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Entity\SeatingPlan;
use App\Entity\SeatingRow;
use App\Entity\SeatingSeat;
use App\Entity\SeatingTable;
use App\Enum\TableShape;
use Psl\Iter;
use Psl\Math;
use Psl\Vec;

/** @phpstan-type Box array{x0: float, y0: float, x1: float, y1: float} the floor an item takes, chairs and a row's label tabs included, as the web draws it */
final class FloorGeometry
{
    public const int CHAIR_RADIUS_CM = 22;

    private const int CHAIR_GAP_CM = 28;

    private const int PLACE_GAP_CM = 24;

    private const int ROW_TAB_CM = 52;

    private const int SEARCH_STEP_CM = 10;

    /** What automatic placement keeps between the placing boxes of any two items: a 36-inch row pitch, rows 22 + 46 + 22 cm apart. */
    public const int PLACE_CLEAR_CM = 46;

    /** A single seat's name, drawn to its right, counted in its placing box. */
    public const int SEAT_NAME_ROOM_CM = 160;

    /** How many rings past the nearest spot with no overlap the search still looks for one that keeps the clearance. */
    private const int CLEAR_REACH_RINGS = 21;

    /** Where a copy goes before it looks for free floor: below and to the right of its original. */
    public const array COPY_OFFSET_CM = [60, 420];

    /** Where each copy of a chosen group goes, exactly, so the copies keep the group's arrangement (sc-4717). */
    public const int GROUP_COPY_OFFSET_CM = 50;

    /** @return array{0: float, 1: float} half the table's width and length, chairs included, before it turns */
    public static function extent(TableShape $shape, int $widthCm, int $lengthCm, int $endSeats): array
    {
        if ($shape->isRound()) {
            $radius = $widthCm / 2 + (TableShape::Cocktail === $shape ? self::PLACE_GAP_CM : self::CHAIR_GAP_CM) + self::CHAIR_RADIUS_CM;

            return [$radius, $radius];
        }

        $ends = $endSeats > 0 ? self::CHAIR_GAP_CM + self::CHAIR_RADIUS_CM : 0;

        return [$widthCm / 2 + $ends, $lengthCm / 2 + self::CHAIR_GAP_CM + self::CHAIR_RADIUS_CM];
    }

    /** @return array{0: float, 1: float} half the row's length, its label tab included, and half its depth, before it turns */
    public static function rowExtent(int $seats, int $spacingCm): array
    {
        return [($seats - 1) / 2 * $spacingCm + self::CHAIR_RADIUS_CM + self::ROW_TAB_CM, self::CHAIR_RADIUS_CM];
    }

    /** @return Box the room it covers, turned, at its own place or at the one given */
    public static function bounds(SeatingTable|SeatingRow|SeatingSeat $item, ?int $xCm = null, ?int $yCm = null): array
    {
        [$ex, $ey, $rotation] = match (true) {
            $item instanceof SeatingTable => [...self::extent($item->getShape(), $item->getWidthCm(), $item->getLengthCm(), $item->getEndSeats()), $item->getRotation()],
            $item instanceof SeatingRow => [...self::rowExtent($item->getSeats(), $item->getSpacingCm()), $item->getRotation()],
            default => [self::CHAIR_RADIUS_CM, self::CHAIR_RADIUS_CM, 0],
        };
        $angle = $rotation * Math\PI / 180;
        $halfX = Math\abs($ex * Math\cos($angle)) + Math\abs($ey * Math\sin($angle));
        $halfY = Math\abs($ex * Math\sin($angle)) + Math\abs($ey * Math\cos($angle));
        $x = $xCm ?? $item->getXCm();
        $y = $yCm ?? $item->getYCm();

        return ['x0' => $x - $halfX, 'y0' => $y - $halfY, 'x1' => $x + $halfX, 'y1' => $y + $halfY];
    }

    /**
     * Top to bottom, then left to right: items whose centres sit within half the first one's depth of it share a line, so tables a few centimetres out of line don't read in a zigzag (sc-4717).
     *
     * @template T of SeatingTable|SeatingRow|SeatingSeat
     *
     * @param list<T> $items
     *
     * @return list<T>
     */
    public static function inReadingOrder(array $items): array
    {
        $left = Vec\sort($items, static fn (SeatingTable|SeatingRow|SeatingSeat $a, SeatingTable|SeatingRow|SeatingSeat $b): int => [$a->getYCm(), $a->getXCm()] <=> [$b->getYCm(), $b->getXCm()]);
        $ordered = [];

        while ([] !== $left) {
            $first = $left[0];
            $box = self::bounds($first);
            $reach = ($box['y1'] - $box['y0']) / 2;
            $line = Vec\filter($left, static fn (SeatingTable|SeatingRow|SeatingSeat $item): bool => Math\abs($item->getYCm() - $first->getYCm()) <= $reach);
            $ordered = [...$ordered, ...Vec\sort($line, static fn (SeatingTable|SeatingRow|SeatingSeat $a, SeatingTable|SeatingRow|SeatingSeat $b): int => $a->getXCm() <=> $b->getXCm())];
            $left = Vec\filter($left, static fn (SeatingTable|SeatingRow|SeatingSeat $item): bool => !Iter\contains($line, $item));
        }

        return $ordered;
    }

    /** Half a centimetre of rounding either way is still inside. */
    public static function inside(SeatingTable|SeatingRow|SeatingSeat $item, int $widthCm, int $lengthCm, ?int $xCm = null, ?int $yCm = null): bool
    {
        $box = self::bounds($item, $xCm, $yCm);

        return $box['x0'] >= -0.5 && $box['y0'] >= -0.5 && $box['x1'] <= $widthCm + 0.5 && $box['y1'] <= $lengthCm + 0.5;
    }

    /** A far wall that moves in past the item's far edge cuts it, whether the item stood inside before or was already through that wall. */
    public static function cutByShrinking(SeatingTable|SeatingRow|SeatingSeat $item, int $widthCm, int $lengthCm, int $toWidthCm, int $toLengthCm): bool
    {
        $box = self::bounds($item);

        return ($toWidthCm < $widthCm && $box['x1'] > $toWidthCm + 0.5) || ($toLengthCm < $lengthCm && $box['y1'] > $toLengthCm + 0.5);
    }

    /**
     * @param list<SeatingTable|SeatingRow|SeatingSeat> $others
     *
     * @return array{0: int, 1: int} the nearest spot to the one given, in rings of 10 cm, inside the room and 46 cm clear of the others;
     *                               the nearest with no overlap when none is clear within a seat's name and the clearance of it; the spot given, moved into the room, when neither is
     */
    public static function nearestFree(SeatingTable|SeatingRow|SeatingSeat $item, array $others, SeatingPlan $plan, int $fromX, int $fromY): array
    {
        $theirs = Vec\filter($others, static fn (SeatingTable|SeatingRow|SeatingSeat $other): bool => !$other->getId()->equals($item->getId()));
        $spaces = Vec\map($theirs, self::placingBox(...));
        $bodies = Vec\map($theirs, self::bounds(...));
        $last = Math\maxva($plan->getWidthCm(), $plan->getLengthCm()) / self::SEARCH_STEP_CM;
        $free = null;
        $freeRing = 0;

        for ($ring = 0; $ring <= $last; ++$ring) {
            if (null !== $free && $ring > $freeRing + self::CLEAR_REACH_RINGS) {
                return $free;
            }

            foreach (self::ring($ring) as [$dx, $dy]) {
                $x = (int) Math\round(($fromX + $dx) / 10) * 10;
                $y = (int) Math\round(($fromY + $dy) / 10) * 10;

                if (!self::inside($item, $plan->getWidthCm(), $plan->getLengthCm(), $x, $y)) {
                    continue;
                }

                if (!self::nearAny(self::placingBox($item, $x, $y), $spaces, self::PLACE_CLEAR_CM)) {
                    return [$x, $y];
                }

                if (null === $free && !self::nearAny(self::bounds($item, $x, $y), $bodies, 0)) {
                    $free = [$x, $y];
                    $freeRing = $ring;
                }
            }
        }

        return $free ?? self::within($item, $plan, $fromX, $fromY);
    }

    /** @return array{0: int, 1: int} the spot moved the least way that puts the item inside the room */
    private static function within(SeatingTable|SeatingRow|SeatingSeat $item, SeatingPlan $plan, int $xCm, int $yCm): array
    {
        $box = self::bounds($item, $xCm, $yCm);
        $halfX = ($box['x1'] - $box['x0']) / 2;
        $halfY = ($box['y1'] - $box['y0']) / 2;

        return [
            (int) Math\round(Math\minva(Math\maxva($xCm, $halfX), $plan->getWidthCm() - $halfX)),
            (int) Math\round(Math\minva(Math\maxva($yCm, $halfY), $plan->getLengthCm() - $halfY)),
        ];
    }

    /** @return Box its bounds, and a single seat's name to its right */
    private static function placingBox(SeatingTable|SeatingRow|SeatingSeat $item, ?int $xCm = null, ?int $yCm = null): array
    {
        $box = self::bounds($item, $xCm, $yCm);

        return $item instanceof SeatingSeat ? [...$box, 'x1' => $box['x1'] + self::SEAT_NAME_ROOM_CM] : $box;
    }

    /**
     * Nearest first; at equal distance below, then above, then right, then left.
     *
     * @return list<array{0: int, 1: int}>
     */
    private static function ring(int $ring): array
    {
        static $rings = [];

        if (isset($rings[$ring])) {
            return $rings[$ring];
        }

        $tries = [];

        for ($dx = -$ring; $dx <= $ring; ++$dx) {
            for ($dy = -$ring; $dy <= $ring; ++$dy) {
                if (Math\maxva(Math\abs($dx), Math\abs($dy)) === $ring) {
                    $tries[] = [$dx * self::SEARCH_STEP_CM, $dy * self::SEARCH_STEP_CM];
                }
            }
        }

        $rings[$ring] = Vec\sort($tries, static fn (array $a, array $b): int => [$a[0] ** 2 + $a[1] ** 2, self::side($a)] <=> [$b[0] ** 2 + $b[1] ** 2, self::side($b)]);

        return $rings[$ring];
    }

    /** @param array{0: int, 1: int} $offset */
    private static function side(array $offset): int
    {
        [$dx, $dy] = $offset;

        if (Math\abs($dy) > Math\abs($dx)) {
            return $dy > 0 ? 0 : 1;
        }

        return $dx > 0 ? 2 : 3;
    }

    /**
     * @param Box       $box
     * @param list<Box> $taken
     */
    private static function nearAny(array $box, array $taken, int $clearCm): bool
    {
        foreach ($taken as $theirs) {
            if ($box['x0'] < $theirs['x1'] + $clearCm && $theirs['x0'] < $box['x1'] + $clearCm && $box['y0'] < $theirs['y1'] + $clearCm && $theirs['y0'] < $box['y1'] + $clearCm) {
                return true;
            }
        }

        return false;
    }
}
