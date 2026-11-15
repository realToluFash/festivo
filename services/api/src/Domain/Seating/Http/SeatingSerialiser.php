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
        $unsectioned = Vec\filter($tables, static fn (SeatingTable $table): bool => null === $table->getSection());

        return [
            'id' => $plan->getId()->toRfc4122(),
            'roomName' => $plan->getRoomName(),
            'widthCm' => $plan->getWidthCm(),
            'lengthCm' => $plan->getLengthCm(),
            'version' => $plan->getVersion(),
            'changedBy' => $plan->getChangedBy()?->getName(),
            'sections' => Vec\map($sections, static fn (SeatingSection $section): array => self::section($section, $tables)),
            'tables' => Vec\map($tables, self::table(...)),
            'rows' => Vec\map($rows, self::row(...)),
            'singleSeats' => Vec\map($singleSeats, self::singleSeat(...)),
            'withoutSection' => ['tables' => Iter\count($unsectioned), 'seats' => self::seatsAt($unsectioned)],
            'counts' => [
                'sections' => Iter\count($sections),
                'tables' => Iter\count($tables),
                'rows' => Iter\count($rows),
                'singleSeats' => Iter\count($singleSeats),
                'seatedGuests' => 0,
            ],
        ];
    }

    /**
     * @param list<SeatingTable> $tables the plan's
     *
     * @return array<string, mixed>
     */
    private static function section(SeatingSection $section, array $tables): array
    {
        $inIt = Vec\filter($tables, static fn (SeatingTable $table): bool => true === $table->getSection()?->getId()->equals($section->getId()));

        return [
            'id' => $section->getId()->toRfc4122(),
            'name' => $section->getName(),
            'colour' => $section->getColour()->value,
            'version' => $section->getVersion(),
            'tables' => Iter\count($inIt),
            'seats' => self::seatsAt($inIt),
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

    /** @param list<SeatingTable> $tables */
    private static function seatsAt(array $tables): int
    {
        return Math\sum(Vec\map($tables, static fn (SeatingTable $table): int => $table->getSeats()));
    }
}
