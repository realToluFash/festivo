<?php

declare(strict_types=1);

namespace App\Domain\Staff\WhosHere;

use App\Domain\Staff\Attendance\ClockWindow;
use App\Domain\Staff\Station\StationSerialiser;
use App\Domain\Staff\WhosHere\Model\WhosHerePlace;
use App\Domain\Staff\WhosHere\Model\WhosHereView;
use App\Entity\Event;
use App\Entity\SeatingSection;
use App\Entity\ShiftAttendance;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\StaffStation;
use App\Enum\EventPhase;
use App\Enum\StationKind;
use App\Repository\ShiftAttendanceRepository;
use App\Repository\StaffJobRepository;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffShiftRepository;
use App\Repository\StaffStationRepository;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Dict;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;

final readonly class WhosHereReader
{
    private const string DUE_WITHIN = '+15 minutes';

    private const string TONIGHT = '+24 hours';

    public function __construct(
        private StaffMemberRepository $staffMemberRepository,
        private StaffShiftRepository $staffShiftRepository,
        private ShiftAttendanceRepository $shiftAttendanceRepository,
        private StaffJobRepository $staffJobRepository,
        private StaffStationRepository $staffStationRepository,
        private StationSerialiser $stationSerialiser,
        private ClockInterface $clock,
    ) {
    }

    public function place(Event $event, StaffMember $person): ?WhosHerePlace
    {
        return self::placeOf($person, $this->staffShiftRepository->findOnEvent($event), $this->attendances($event), $this->clock->now());
    }

    /** @return array<string, mixed> */
    public function read(Event $event, WhosHereView $view): array
    {
        $now = $this->clock->now();
        $zone = new DateTimeZone($event->getTimeZone());
        $shifts = $this->staffShiftRepository->findOnEvent($event);
        $attendances = $this->attendances($event);
        $roster = $this->staffMemberRepository->findOnEvent($event);
        $placed = Vec\filter_nulls(Vec\map($roster, static fn (StaffMember $person): ?WhosHerePlace => self::placeOf($person, $shifts, $attendances, $now)));

        $here = Vec\map(Vec\filter($placed, static fn (WhosHerePlace $one): bool => WhosHerePlace::HERE === $one->list), static fn (WhosHerePlace $one): StaffMember => $one->person);
        $hereAt = static fn (?string $id): array => null === $id ? [] : Vec\filter($here, static fn (StaffMember $one): bool => $id === (self::ref($one->getStation())['id'] ?? null));
        $row = static function (WhosHerePlace $place) use ($here, $hereAt, $view, $zone): array {
            $person = $place->person;
            $cover = Iter\search($here, static fn (StaffMember $other): bool => $other->getCovering() === $person && $other->getStation() === $person->getStation());
            $movedAt = $person->getMovedAt();
            $movedFrom = $person->getMovedFrom();
            $station = self::ref($person->getStation());

            return [
                'id' => $person->getId()->toRfc4122(),
                'name' => $person->getFullName(),
                'job' => $person->getJob()?->getName(),
                'station' => $station,
                'shiftStartsAt' => self::written(ClockWindow::startOf($place->shift), $zone),
                'shiftEndsAt' => self::written(ClockWindow::endOf($place->shift), $zone),
                'clockedInAt' => null === $place->in ? null : self::written($place->in, $zone),
                'phone' => $person->getMobile(),
                'canAddMobile' => null === $person->getMobile() && WhosHereAccess::maySetMobile($view, $person),
                'coveredBy' => $cover?->getFullName(),
                'movedFrom' => null === $movedAt || null === $movedFrom ? null : ['station' => $movedFrom, 'at' => self::written($movedAt, $zone)],
                'nobodyHere' => null !== $station && [] === $hereAt($station['id']),
            ];
        };
        $listed = static fn (string $list): array => Vec\filter($placed, static fn (WhosHerePlace $one): bool => $list === $one->list && WhosHereAccess::shows($view, $one->person));
        $byStart = static fn (WhosHerePlace $one, WhosHerePlace $other): int => [ClockWindow::startOf($one->shift), Str\lowercase($one->person->getFullName())] <=> [ClockWindow::startOf($other->shift), Str\lowercase($other->person->getFullName())];
        $latestIn = static fn (WhosHerePlace $one, WhosHerePlace $other): int => ($other->in?->getTimestamp() ?? 0) <=> ($one->in?->getTimestamp() ?? 0);
        $stations = [
            ...Vec\filter_nulls(Vec\map($this->staffStationRepository->findPlaces($event), self::ref(...))),
            ...Vec\map($this->stationSerialiser->sections($event), static fn (SeatingSection $section): array => ['id' => $section->getId()->toRfc4122(), 'name' => $section->getName()]),
        ];

        return [
            'now' => self::written($now, $zone),
            'timeZone' => $event->getTimeZone(),
            'countryCode' => $event->getVenueCountryCode(),
            'ended' => self::ended($event, $now),
            'rosterSize' => Iter\count($roster),
            'viewer' => [
                'station' => self::ref($view->station),
                'canCover' => $view->canCover,
                'canAddWalkOn' => true,
            ],
            'notHere' => Vec\map(Vec\sort($listed(WhosHerePlace::NOT_HERE), $byStart), $row),
            'here' => Vec\map(Vec\sort($listed(WhosHerePlace::HERE), $latestIn), $row),
            'didntClockIn' => Vec\map(Vec\sort($listed(WhosHerePlace::DIDNT_CLOCK_IN), $byStart), $row),
            'stations' => null !== $view->station ? [] : Vec\map($stations, static fn (array $station): array => $station + [
                'people' => Vec\map($hereAt($station['id']), static fn (StaffMember $one): string => $one->getFullName()),
            ]),
            'doorStations' => null !== $view->station ? Vec\filter_nulls([self::ref($view->station)]) : $stations,
            'jobs' => Vec\map($this->staffJobRepository->findOnEvent($event), static fn (StaffJob $job): array => self::walkOnJob($job, $shifts, $event, $now, $zone)),
        ];
    }

    /**
     * @param list<StaffShift> $shifts the event's
     *
     * @return array{end: DateTimeImmutable, kind: 'shift'|'event'|'day'}
     */
    public static function walkOnEnd(StaffJob $job, array $shifts, Event $event, DateTimeImmutable $now): array
    {
        $tonight = $now->modify(self::TONIGHT);
        $latest = null;

        foreach ($shifts as $shift) {
            $end = ClockWindow::endOf($shift);

            if ($shift->getJob() === $job && $end > $now && $end <= $tonight && (null === $latest || $end > $latest)) {
                $latest = $end;
            }
        }

        if (null !== $latest) {
            return ['end' => $latest, 'kind' => 'shift'];
        }

        $eventEnd = $event->getEndedAt() ?? $event->getEndsAt();

        return $eventEnd <= $tonight ? ['end' => $eventEnd, 'kind' => 'event'] : ['end' => $tonight, 'kind' => 'day'];
    }

    public static function ended(Event $event, DateTimeImmutable $now): bool
    {
        return EventPhase::Finished === EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now);
    }

    /** @return ?array{id: string, name: string} a place by its id, a section by the seating section's, as Stations names them (sc-3910) */
    public static function ref(?StaffStation $station): ?array
    {
        if (null === $station) {
            return null;
        }

        $section = $station->getSection();

        if (StationKind::Section === $station->getKind()) {
            return null === $section ? null : ['id' => $section->getId()->toRfc4122(), 'name' => $section->getName()];
        }

        return ['id' => $station->getId()->toRfc4122(), 'name' => $station->getName()];
    }

    /** @return array<string, mixed> */
    private function attendances(Event $event): array
    {
        return Dict\reindex(
            $this->shiftAttendanceRepository->findOnEvent($event),
            static fn (ShiftAttendance $attendance): string => $attendance->getShift()->getId()->toRfc4122() . ':' . $attendance->getPersonId()->toRfc4122(),
        );
    }

    /**
     * @param list<StaffShift>     $shifts
     * @param array<string, mixed> $attendances by shift and person
     */
    private static function placeOf(StaffMember $person, array $shifts, array $attendances, DateTimeImmutable $now): ?WhosHerePlace
    {
        $theirs = Vec\filter($shifts, static fn (StaffShift $shift): bool => Iter\contains($shift->getPeople(), $person));
        $of = static function (StaffShift $shift) use ($attendances, $person): ?ShiftAttendance {
            $found = $attendances[$shift->getId()->toRfc4122() . ':' . $person->getId()->toRfc4122()] ?? null;

            return $found instanceof ShiftAttendance ? $found : null;
        };
        $inAt = static fn (StaffShift $shift): int => $of($shift)?->countedIn()?->getTimestamp() ?? 0;
        $on = Iter\last(Vec\sort(
            Vec\filter($theirs, static fn (StaffShift $shift): bool => ClockWindow::stillOn($shift, $of($shift), $now)),
            static fn (StaffShift $one, StaffShift $other): int => $inAt($one) <=> $inAt($other),
        ));

        if (null !== $on) {
            return new WhosHerePlace($person, WhosHerePlace::HERE, $on, $of($on)?->countedIn());
        }

        $notIn = Vec\filter($theirs, static fn (StaffShift $shift): bool => null === $of($shift)?->countedIn());
        $due = Iter\first(Vec\sort(
            Vec\filter($notIn, static fn (StaffShift $shift): bool => ClockWindow::startOf($shift) <= $now->modify(self::DUE_WITHIN) && ClockWindow::endOf($shift) > $now),
            static fn (StaffShift $one, StaffShift $other): int => ClockWindow::startOf($one) <=> ClockWindow::startOf($other),
        ));

        if (null !== $due) {
            return new WhosHerePlace($person, WhosHerePlace::NOT_HERE, $due, null);
        }

        $missed = Iter\last(Vec\sort(
            Vec\filter($notIn, static fn (StaffShift $shift): bool => ClockWindow::endOf($shift) <= $now && ClockWindow::endOf($shift) > $now->modify('-24 hours')),
            static fn (StaffShift $one, StaffShift $other): int => ClockWindow::endOf($one) <=> ClockWindow::endOf($other),
        ));

        return null === $missed ? null : new WhosHerePlace($person, WhosHerePlace::DIDNT_CLOCK_IN, $missed, null);
    }

    /**
     * @param list<StaffShift> $shifts
     *
     * @return array{id: string, name: string, walkOnEndsAt: string, walkOnEnd: 'shift'|'event'|'day'}
     */
    private static function walkOnJob(StaffJob $job, array $shifts, Event $event, DateTimeImmutable $now, DateTimeZone $zone): array
    {
        $end = self::walkOnEnd($job, $shifts, $event, $now);

        return [
            'id' => $job->getId()->toRfc4122(),
            'name' => $job->getName(),
            'walkOnEndsAt' => self::written($end['end'], $zone),
            'walkOnEnd' => $end['kind'],
        ];
    }

    private static function written(DateTimeImmutable $at, DateTimeZone $zone): string
    {
        return $at->setTimezone($zone)->format(\DATE_ATOM);
    }
}
