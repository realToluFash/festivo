<?php

declare(strict_types=1);

namespace App\Domain\Seating\Numbers;

use App\Entity\SeatAssignment;
use App\Entity\SeatingRow;
use App\Entity\SeatingSeat;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Enum\TableShape;
use Psl\Dict;
use Psl\Iter;
use Psl\Math;
use Psl\Vec;

/**
 * @phpstan-type Breakdown array{tables: int, tablesByShape: array<value-of<TableShape>, int>, rows: int, singleSeats: int, seats: int, taken: int, heldForCompanion: int, unusable: int, free: int}
 */
final class SeatingTally
{
    /**
     * @param list<SeatingSection> $sections
     * @param list<SeatingTable>   $tables
     * @param list<SeatingRow>     $rows
     * @param list<SeatingSeat>    $singleSeats
     * @param list<SeatAssignment> $assignments
     *
     * @return array{plan: Breakdown, sections: list<array{id: string, name: string, counts: Breakdown}>, noSection: Breakdown}
     */
    public static function of(array $sections, array $tables, array $rows, array $singleSeats, array $assignments): array
    {
        $seated = [];
        foreach ($assignments as $assignment) {
            $seated[$assignment->getPlaceId()->toRfc4122()][$assignment->getSeat()] = null === $assignment->getGuest()->getFullName();
        }

        $in = static fn (?SeatingSection $of, ?SeatingSection $section): bool => null === $section ? null === $of : true === $of?->getId()->equals($section->getId());
        $count = static fn (?SeatingSection $section, bool $all): array => self::breakdown(
            Vec\filter($tables, static fn (SeatingTable $table): bool => $all || $in($table->getSection(), $section)),
            Vec\filter($rows, static fn (SeatingRow $row): bool => $all || $in($row->getSection(), $section)),
            Vec\filter($singleSeats, static fn (SeatingSeat $seat): bool => $all || $in($seat->getSection(), $section)),
            $seated,
        );

        return [
            'plan' => $count(null, true),
            'sections' => Vec\map($sections, static fn (SeatingSection $section): array => ['id' => $section->getId()->toRfc4122(), 'name' => $section->getName(), 'counts' => $count($section, false)]),
            'noSection' => $count(null, false),
        ];
    }

    /** @return Breakdown */
    public static function none(): array
    {
        return self::breakdown([], [], [], []);
    }

    /**
     * @param list<SeatingTable>              $tables
     * @param list<SeatingRow>                $rows
     * @param list<SeatingSeat>               $singleSeats
     * @param array<string, array<int, bool>> $seated      by place id, then seat: true when held for a companion
     *
     * @return Breakdown
     */
    private static function breakdown(array $tables, array $rows, array $singleSeats, array $seated): array
    {
        $places = [
            ...Vec\map($tables, static fn (SeatingTable $table): array => [$table->getId()->toRfc4122(), $table->getSeats(), $table->getUnusableSeats()]),
            ...Vec\map($rows, static fn (SeatingRow $row): array => [$row->getId()->toRfc4122(), $row->getSeats(), $row->getUnusableSeats()]),
            ...Vec\map($singleSeats, static fn (SeatingSeat $seat): array => [$seat->getId()->toRfc4122(), 1, $seat->isUnusable() ? [1] : []]),
        ];
        $seats = 0;
        $taken = 0;
        $held = 0;
        $unusable = 0;

        foreach ($places as [$id, $chairs, $marked]) {
            $at = $seated[$id] ?? [];
            $seats += $chairs;
            $held += Iter\count(Vec\filter($at, static fn (bool $companion): bool => $companion));
            $taken += Iter\count(Vec\filter($at, static fn (bool $companion): bool => !$companion));
            $unusable += Iter\count(Vec\filter(Vec\unique($marked), static fn (int $seat): bool => $seat >= 1 && $seat <= $chairs && !Iter\contains_key($at, $seat)));
        }

        return [
            'tables' => Iter\count($tables),
            'tablesByShape' => Dict\from_keys(
                Vec\map(TableShape::cases(), static fn (TableShape $shape): string => $shape->value),
                static fn (string $shape): int => Iter\count(Vec\filter($tables, static fn (SeatingTable $table): bool => $table->getShape()->value === $shape)),
            ),
            'rows' => Iter\count($rows),
            'singleSeats' => Iter\count($singleSeats),
            'seats' => $seats,
            'taken' => $taken,
            'heldForCompanion' => $held,
            'unusable' => $unusable,
            'free' => Math\maxva(0, $seats - $taken - $held - $unusable),
        ];
    }
}
