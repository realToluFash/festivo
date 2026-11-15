<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Entity\SeatingPlan;
use App\Entity\SeatingRow;
use App\Entity\SeatingSeat;
use App\Entity\SeatingTable;
use App\Enum\TableShape;
use Psl\Math;
use Psl\Vec;

/** @phpstan-type Box array{x0: float, y0: float, x1: float, y1: float} the floor an item takes, chairs and a row's label tabs included, as the web draws it */
final class FloorGeometry
{
    public const int CHAIR_RADIUS_CM = 22;

    private const int CHAIR_GAP_CM = 28;

    private const int PLACE_GAP_CM = 24;

    private const int ROW_TAB_CM = 52;

    private const int SEARCH_STEP_CM = 20;

    /** Where a copy goes before it looks for free floor: below and to the right of its original. */
    public const array COPY_OFFSET_CM = [60, 420];

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
     * @return array{0: int, 1: int} the nearest spot to the one given, in rings of 20 cm, inside the room and clear of the others; the spot given when none is
     */
    public static function nearestFree(SeatingTable|SeatingRow|SeatingSeat $item, array $others, SeatingPlan $plan, int $fromX, int $fromY): array
    {
        $limit = Math\maxva($plan->getWidthCm(), $plan->getLengthCm());
        $taken = Vec\map(Vec\filter($others, static fn (SeatingTable|SeatingRow|SeatingSeat $other): bool => !$other->getId()->equals($item->getId())), self::bounds(...));

        for ($ring = 0; $ring * self::SEARCH_STEP_CM <= $limit; ++$ring) {
            $tries = [];

            for ($dx = -$ring; $dx <= $ring; ++$dx) {
                for ($dy = -$ring; $dy <= $ring; ++$dy) {
                    if (Math\maxva(Math\abs($dx), Math\abs($dy)) === $ring) {
                        $tries[] = [$fromX + $dx * self::SEARCH_STEP_CM, $fromY + $dy * self::SEARCH_STEP_CM];
                    }
                }
            }

            $nearestFirst = Vec\sort_by($tries, static fn (array $at): int => ($at[0] - $fromX) ** 2 + ($at[1] - $fromY) ** 2);

            foreach ($nearestFirst as [$x, $y]) {
                if (self::inside($item, $plan->getWidthCm(), $plan->getLengthCm(), $x, $y) && !self::overlapsAny(self::bounds($item, $x, $y), $taken)) {
                    return [$x, $y];
                }
            }
        }

        return [$fromX, $fromY];
    }

    /**
     * @param Box       $box
     * @param list<Box> $taken
     */
    private static function overlapsAny(array $box, array $taken): bool
    {
        foreach ($taken as $theirs) {
            if ($box['x0'] < $theirs['x1'] && $theirs['x0'] < $box['x1'] && $box['y0'] < $theirs['y1'] && $theirs['y0'] < $box['y1']) {
                return true;
            }
        }

        return false;
    }
}
