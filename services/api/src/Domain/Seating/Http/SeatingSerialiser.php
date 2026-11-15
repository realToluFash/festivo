<?php

declare(strict_types=1);

namespace App\Domain\Seating\Http;

use App\Entity\Event;
use App\Entity\SeatingPlan;
use App\Entity\SeatingRow;
use App\Entity\SeatingSeat;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Enum\MeasurementSystem;
use App\Repository\SeatingRowRepository;
use App\Repository\SeatingSeatRepository;
use App\Repository\SeatingSectionRepository;
use App\Repository\SeatingTableRepository;
use Psl\Iter;
use Psl\Math;
use Psl\Vec;

/** Seated guests count as none until sc-4013 can place them (sc-3998, sc-4000, sc-4003). */
final readonly class SeatingSerialiser
{
    public function __construct(
        private SeatingSectionRepository $seatingSectionRepository,
        private SeatingTableRepository $seatingTableRepository,
        private SeatingRowRepository $seatingRowRepository,
        private SeatingSeatRepository $seatingSeatRepository,
    ) {
    }

    /** @return array<string, mixed> */
    public function seating(Event $event, ?SeatingPlan $plan): array
    {
        return [
            'measurementSystem' => MeasurementSystem::forTerritory($event->getOrganisation()->getCountryCode())->value,
            'plan' => null === $plan ? null : $this->plan($plan),
        ];
    }

    /** @return array<string, mixed> */
    private function plan(SeatingPlan $plan): array
    {
        $sections = $this->seatingSectionRepository->findInPlan($plan);
        $tables = $this->seatingTableRepository->findInPlan($plan);
        $rows = $this->seatingRowRepository->findInPlan($plan);
        $singleSeats = $this->seatingSeatRepository->findInPlan($plan);

        return [
            'id' => $plan->getId()->toRfc4122(),
            'roomName' => $plan->getRoomName(),
            'widthCm' => $plan->getWidthCm(),
            'lengthCm' => $plan->getLengthCm(),
            'version' => $plan->getVersion(),
            'changedBy' => $plan->getChangedBy()?->getName(),
            'sections' => Vec\map($sections, static fn (SeatingSection $section): array => [...self::section($section), ...self::contents($section, $tables, $rows, $singleSeats)]),
            'tables' => Vec\map($tables, self::table(...)),
            'rows' => Vec\map($rows, self::row(...)),
            'singleSeats' => Vec\map($singleSeats, self::singleSeat(...)),
            'withoutSection' => self::contents(null, $tables, $rows, $singleSeats),
            'counts' => [
                'sections' => Iter\count($sections),
                'tables' => Iter\count($tables),
                'rows' => Iter\count($rows),
                'singleSeats' => Iter\count($singleSeats),
                'seatedGuests' => 0,
            ],
        ];
    }

    /** @return array<string, mixed> */
    private static function section(SeatingSection $section): array
    {
        return [
            'id' => $section->getId()->toRfc4122(),
            'name' => $section->getName(),
            'colour' => $section->getColour()->value,
            'version' => $section->getVersion(),
        ];
    }

    /**
     * What sits in a section, or in none when `$section` is null; `seats` counts every chair at its tables, in its rows and its single seats.
     *
     * @param list<SeatingTable> $tables      the plan's
     * @param list<SeatingRow>   $rows        the plan's
     * @param list<SeatingSeat>  $singleSeats the plan's
     *
     * @return array{tables: int, rows: int, singleSeats: int, seats: int}
     */
    private static function contents(?SeatingSection $section, array $tables, array $rows, array $singleSeats): array
    {
        $in = static fn (?SeatingSection $of): bool => null === $section ? null === $of : true === $of?->getId()->equals($section->getId());
        $tables = Vec\filter($tables, static fn (SeatingTable $table): bool => $in($table->getSection()));
        $rows = Vec\filter($rows, static fn (SeatingRow $row): bool => $in($row->getSection()));
        $singleSeats = Vec\filter($singleSeats, static fn (SeatingSeat $seat): bool => $in($seat->getSection()));
        $chairs = Vec\concat(
            Vec\map($tables, static fn (SeatingTable $table): int => $table->getSeats()),
            Vec\map($rows, static fn (SeatingRow $row): int => $row->getSeats()),
        );

        return [
            'tables' => Iter\count($tables),
            'rows' => Iter\count($rows),
            'singleSeats' => Iter\count($singleSeats),
            'seats' => Math\sum($chairs) + Iter\count($singleSeats),
        ];
    }

    /**
     * A round or cocktail table's `widthCm` and `lengthCm` are both its diameter; `xCm` and `yCm` are its centre from the room's top left corner.
     *
     * @return array<string, mixed>
     */
    private static function table(SeatingTable $table): array
    {
        return [
            'id' => $table->getId()->toRfc4122(),
            'name' => $table->getName(),
            'sectionId' => $table->getSection()?->getId()->toRfc4122(),
            'shape' => $table->getShape()->value,
            'seats' => $table->getSeats(),
            'widthCm' => $table->getWidthCm(),
            'lengthCm' => $table->getLengthCm(),
            'endSeats' => $table->getEndSeats(),
            'rotation' => $table->getRotation(),
            'xCm' => $table->getXCm(),
            'yCm' => $table->getYCm(),
            'unusableSeats' => $table->getUnusableSeats(),
            'version' => $table->getVersion(),
            'changedBy' => $table->getChangedBy()?->getName(),
        ];
    }

    /**
     * Seat 1 is on the left of a guest sitting in the row and facing the front; `xCm` and `yCm` are the row's centre, and `rotation` turns it clockwise about it.
     *
     * @return array<string, mixed>
     */
    private static function row(SeatingRow $row): array
    {
        return [
            'id' => $row->getId()->toRfc4122(),
            'label' => $row->getLabel(),
            'sectionId' => $row->getSection()?->getId()->toRfc4122(),
            'seats' => $row->getSeats(),
            'spacingCm' => $row->getSpacingCm(),
            'rotation' => $row->getRotation(),
            'xCm' => $row->getXCm(),
            'yCm' => $row->getYCm(),
            'unusableSeats' => $row->getUnusableSeats(),
            'version' => $row->getVersion(),
            'changedBy' => $row->getChangedBy()?->getName(),
        ];
    }

    /** @return array<string, mixed> */
    private static function singleSeat(SeatingSeat $seat): array
    {
        return [
            'id' => $seat->getId()->toRfc4122(),
            'name' => $seat->getName(),
            'sectionId' => $seat->getSection()?->getId()->toRfc4122(),
            'xCm' => $seat->getXCm(),
            'yCm' => $seat->getYCm(),
            'unusable' => $seat->isUnusable(),
            'version' => $seat->getVersion(),
            'changedBy' => $seat->getChangedBy()?->getName(),
        ];
    }
}
