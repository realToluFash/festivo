<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Entity\SeatAssignment;
use App\Entity\SeatingRow;
use App\Entity\SeatingTable;

/** A taken seat as a guest's page (sc-4022) and the door (sc-60684) both name it, so the two never word one seat two ways. */
final class SeatPlace
{
    /** @return array<string, mixed> a table by its name, a row by its label and the seat in it, a single seat by its name; each with its section's name or null */
    public static function of(SeatAssignment $assignment): array
    {
        $place = $assignment->getPlace();
        $section = $place->getSection()?->getName();

        return match (true) {
            $place instanceof SeatingTable => ['kind' => 'table', 'name' => $place->getName(), 'section' => $section],
            $place instanceof SeatingRow => ['kind' => 'row', 'name' => $place->getLabel(), 'seat' => $assignment->getSeat(), 'section' => $section],
            default => ['kind' => 'seat', 'name' => $place->getName(), 'section' => $section],
        };
    }
}
