<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Entity\SeatingPlan;
use App\Entity\SeatingTable;
use App\Enum\TableShape;
use Psl\Math;
use Psl\Vec;

/** A table's floor with its chairs, as packages/domain seatingTables.ts draws it: a chair 44 cm across, 28 cm off the edge, 24 off a cocktail table's. */
final class TableGeometry
{
    public const int CHAIR_RADIUS_CM = 22;

    private const int CHAIR_GAP_CM = 28;

    private const int PLACE_GAP_CM = 24;

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

    /** @return array{x0: float, y0: float, x1: float, y1: float} the room it covers, turned */
    public static function bounds(SeatingTable $table, ?int $xCm = null, ?int $yCm = null): array
    {
        [$ex, $ey] = self::extent($table->getShape(), $table->getWidthCm(), $table->getLengthCm(), $table->getEndSeats());
        $angle = $table->getRotation() * Math\PI / 180;
        $halfX = Math\abs($ex * Math\cos($angle)) + Math\abs($ey * Math\sin($angle));
        $halfY = Math\abs($ex * Math\sin($angle)) + Math\abs($ey * Math\cos($angle));
        $x = $xCm ?? $table->getXCm();
        $y = $yCm ?? $table->getYCm();

        return ['x0' => $x - $halfX, 'y0' => $y - $halfY, 'x1' => $x + $halfX, 'y1' => $y + $halfY];
    }

    /** Half a centimetre of rounding either way is still inside. */
    public static function inside(SeatingTable $table, int $widthCm, int $lengthCm, ?int $xCm = null, ?int $yCm = null): bool
    {
        $box = self::bounds($table, $xCm, $yCm);

        return $box['x0'] >= -0.5 && $box['y0'] >= -0.5 && $box['x1'] <= $widthCm + 0.5 && $box['y1'] <= $lengthCm + 0.5;
    }

    /**
     * @param list<SeatingTable> $others the nearest spot to `$from`, in rings of 20 cm, inside the room and clear of them; `$from` itself when none is
     *
     * @return array{0: int, 1: int}
     */
    public static function nearestFree(SeatingTable $table, array $others, SeatingPlan $plan, int $fromX, int $fromY): array
    {
        $limit = Math\maxva($plan->getWidthCm(), $plan->getLengthCm());

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
                if (self::inside($table, $plan->getWidthCm(), $plan->getLengthCm(), $x, $y) && !self::overlapsAny($table, $others, $x, $y)) {
                    return [$x, $y];
                }
            }
        }

        return [$fromX, $fromY];
    }

    /** @param list<SeatingTable> $others */
    private static function overlapsAny(SeatingTable $table, array $others, int $xCm, int $yCm): bool
    {
        $box = self::bounds($table, $xCm, $yCm);

        foreach ($others as $other) {
            if ($other->getId()->equals($table->getId())) {
                continue;
            }

            $theirs = self::bounds($other);

            if ($box['x0'] < $theirs['x1'] && $theirs['x0'] < $box['x1'] && $box['y0'] < $theirs['y1'] && $theirs['y0'] < $box['y1']) {
                return true;
            }
        }

        return false;
    }
}
