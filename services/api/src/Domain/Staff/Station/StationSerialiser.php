<?php

declare(strict_types=1);

namespace App\Domain\Staff\Station;

use App\Entity\Event;
use App\Entity\SeatingSection;
use App\Entity\StaffMember;
use App\Entity\StaffStation;
use App\Enum\StationKind;
use App\Repository\SeatingPlanRepository;
use App\Repository\SeatingSectionRepository;
use App\Repository\SeatingTableRepository;
use App\Repository\StaffStationRepository;
use Psl\Vec;

/** An event's stations as Stations and the roster read them (sc-3910). A section is listed from the seating plan, by the seating section's id, whether or not anyone is on it yet. */
final readonly class StationSerialiser
{
    public function __construct(
        private StaffStationRepository $staffStationRepository,
        private SeatingPlanRepository $seatingPlanRepository,
        private SeatingSectionRepository $seatingSectionRepository,
        private SeatingTableRepository $seatingTableRepository,
        private DishedItemsReader $dishedItemsReader,
    ) {
    }

    /**
     * @param list<StaffMember> $staff
     *
     * @return array{places: list<array<string, mixed>>, sections: list<array<string, mixed>>, floorLead: ?string, courses: list<array<string, mixed>>, walk: list<string>}
     */
    public function stations(Event $event, array $staff): array
    {
        $places = $this->staffStationRepository->findPlaces($event);
        $courses = $this->dishedItemsReader->read($event);
        $counts = DishedItemsReader::counts($courses);
        $atThePass = DishedItemsReader::atThePass($courses);
        $pass = $this->pass($places);
        $rows = [];

        foreach ($this->staffStationRepository->findSections($event) as $row) {
            $section = $row->getSection();

            if (null !== $section) {
                $rows[$section->getId()->toRfc4122()] = $row;
            }
        }

        $tables = $this->tables($event);
        $people = static fn (StaffStation $station): array => Vec\map(
            Vec\filter($staff, static fn (StaffMember $person): bool => $person->getStation() === $station || $person->getAsWellStation() === $station),
            static fn (StaffMember $person): string => $person->getId()->toRfc4122(),
        );
        $floorLead = null;

        foreach ($staff as $person) {
            if ($person->isFloorLead()) {
                $floorLead = $person->getId()->toRfc4122();
            }
        }

        return [
            'places' => Vec\map($places, static fn (StaffStation $place): array => [
                'id' => $place->getId()->toRfc4122(),
                'name' => $place->getName(),
                'pass' => StationKind::Pass === $place->getKind(),
                'people' => $people($place),
                'lead' => $place->getLead()?->getId()->toRfc4122(),
                'dishes' => StationKind::Pass === $place->getKind() ? $atThePass : $counts[$place->getId()->toRfc4122()] ?? 0,
            ]),
            'sections' => Vec\map($this->sections($event), static function (SeatingSection $section) use ($rows, $tables, $people): array {
                $id = $section->getId()->toRfc4122();
                $row = $rows[$id] ?? null;

                return [
                    'id' => $id,
                    'name' => $section->getName(),
                    'tables' => $tables[$id] ?? [],
                    'people' => null === $row ? [] : $people($row),
                    'lead' => $row?->getLead()?->getId()->toRfc4122(),
                ];
            }),
            'floorLead' => $floorLead,
            'courses' => Vec\map($courses, static fn (array $course): array => [
                'id' => $course['course']->getId()->toRfc4122(),
                'name' => $course['course']->getName(),
                'items' => Vec\map($course['items'], static fn (array $item): array => [
                    'name' => $item['name'],
                    'dishedAt' => ($item['station'] ?? $pass)?->getId()->toRfc4122(),
                ]),
            ]),
            'walk' => Vec\map(DishedItemsReader::walk($places, $counts), static fn (StaffStation $place): string => $place->getId()->toRfc4122()),
        ];
    }

    /**
     * @param ?array<string, list<array{id: string, name: string}>> $tables
     *
     * @return array{station: ?array<array-key, mixed>, stations: list<array<array-key, mixed>>, stationRemoved: ?string, leads: bool, floorLead: bool}
     */
    public function person(StaffMember $person, ?array $tables = null): array
    {
        $row = $person->getStation();
        $removed = null !== $row && StationKind::Section === $row->getKind() && null === $row->getSection();
        $tables ??= $this->tables($person->getEvent());
        $station = $removed ? null : $this->ref($row, $tables);
        $asWell = $this->ref($person->getAsWellStation(), $tables);

        return [
            'station' => $station,
            'stations' => Vec\filter_nulls([$station, $asWell]),
            'stationRemoved' => $removed ? $row->getName() : null,
            'leads' => (null !== $station && $row?->getLead() === $person) || $person->getAsWellStation()?->getLead() === $person,
            'floorLead' => $person->isFloorLead(),
        ];
    }

    /** @return array<string, list<array{id: string, name: string}>> */
    public function tables(Event $event): array
    {
        $plan = $this->seatingPlanRepository->findOneForEvent($event);
        $bySection = [];

        foreach (null === $plan ? [] : $this->seatingTableRepository->findInPlan($plan) as $table) {
            $section = $table->getSection();

            if (null !== $section) {
                $bySection[$section->getId()->toRfc4122()][] = ['id' => $table->getId()->toRfc4122(), 'name' => $table->getName()];
            }
        }

        return $bySection;
    }

    /** @return list<SeatingSection> */
    public function sections(Event $event): array
    {
        $plan = $this->seatingPlanRepository->findOneForEvent($event);

        return null === $plan ? [] : $this->seatingSectionRepository->findInPlan($plan);
    }

    /** @param array<string, list<array{id: string, name: string}>> $tables */
    private function ref(?StaffStation $row, array $tables): ?array
    {
        $section = $row?->getSection();

        if (null === $row || (StationKind::Section === $row->getKind() && null === $section)) {
            return null;
        }

        return null === $section
            ? ['id' => $row->getId()->toRfc4122(), 'name' => $row->getName(), 'kind' => 'place', 'tables' => []]
            : ['id' => $section->getId()->toRfc4122(), 'name' => $section->getName(), 'kind' => 'section', 'tables' => $tables[$section->getId()->toRfc4122()] ?? []];
    }

    /** @param list<StaffStation> $places */
    private function pass(array $places): ?StaffStation
    {
        foreach ($places as $place) {
            if (StationKind::Pass === $place->getKind()) {
                return $place;
            }
        }

        return null;
    }
}
