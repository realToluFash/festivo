<?php

declare(strict_types=1);

namespace App\Domain\Staff\Link;

use App\Domain\Event\LocalTimeResolver;
use App\Domain\Staff\ShiftClock;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\GuestNeed;
use App\Entity\ScheduleItem;
use App\Entity\SeatAssignment;
use App\Entity\SeatingTable;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\StaffStation;
use App\Enum\NeedKind;
use App\Enum\Permission;
use App\Repository\GuestNeedRepository;
use App\Repository\ScheduleItemRepository;
use App\Repository\SeatAssignmentRepository;
use App\Repository\SeatingTableRepository;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffShiftRepository;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Symfony\Component\Clock\ClockInterface;

/** One person's night (sc-3915): no other staff member beyond their lead, and no guest's contact details, ever leave here. */
final readonly class MyNight
{
    public function __construct(
        private StaffShiftRepository $staffShiftRepository,
        private StaffMemberRepository $staffMemberRepository,
        private ScheduleItemRepository $scheduleItemRepository,
        private SeatingTableRepository $seatingTableRepository,
        private SeatAssignmentRepository $seatAssignmentRepository,
        private GuestNeedRepository $guestNeedRepository,
        private ClockInterface $clock,
    ) {
    }

    /** @return array<string, mixed> times in the event's offset; `tables` is null with no section station, and empty until doors open; `checksIn` when their job's level opens the door (sc-28230) */
    public function of(StaffMember $entry, DateTimeImmutable $until): array
    {
        $event = $entry->getEvent();
        $zone = new DateTimeZone($event->getTimeZone());
        $now = $this->clock->now();
        $shifts = $this->staffShiftRepository->findOfPerson($entry);
        $shown = self::shown($shifts, $event, $now);
        $later = null === $shown ? null : Iter\first(Vec\filter($shifts, static fn (StaffShift $shift): bool => $shift->getStartsAt() > $shown->getStartsAt()));
        $station = $entry->getStation();
        $doorsAt = $event->getStartsAt()->setTimezone($zone);

        return [
            'event' => ['id' => $event->getId()->toRfc4122(), 'name' => $event->getName(), 'timeZone' => $event->getTimeZone()],
            'endsAt' => $until->setTimezone($zone)->format(\DATE_ATOM),
            'station' => null === $station ? null : self::stationName($station),
            'job' => $shown?->getJob()->getName() ?? $entry->getJob()?->getName(),
            'shift' => null === $shown ? null : [
                'job' => $shown->getJob()->getName(),
                'startsAt' => self::at($shown->getStartsAt(), $event, $zone),
                'endsAt' => self::at($shown->getEndsAt(), $event, $zone),
            ],
            'later' => null === $later ? null : ['job' => $later->getJob()->getName(), 'startsAt' => self::at($later->getStartsAt(), $event, $zone)],
            'lead' => $this->lead($entry),
            'timing' => $this->timing($event, $zone),
            'doorsAt' => $doorsAt->format(\DATE_ATOM),
            'tables' => $this->tables($station, $now >= $doorsAt),
            'checksIn' => Iter\contains(StaffLinkGrants::levelOf($entry)->permissions(), Permission::GuestsCheckIn),
        ];
    }

    /** @param list<StaffShift> $shifts by start; the one under way, else the next, else the last */
    private static function shown(array $shifts, Event $event, DateTimeImmutable $now): ?StaffShift
    {
        return Iter\first(Vec\filter($shifts, static fn (StaffShift $shift): bool => ShiftClock::instant($shift->getEndsAt(), $event) > $now)) ?? Iter\last($shifts);
    }

    private static function at(DateTimeImmutable $wall, Event $event, DateTimeZone $zone): string
    {
        return ShiftClock::instant($wall, $event)->setTimezone($zone)->format(\DATE_ATOM);
    }

    private static function stationName(StaffStation $station): string
    {
        return $station->getSection()?->getName() ?? $station->getName();
    }

    /** @return array{name: string, phone: ?string, floor: bool}|null their station's lead, else the floor lead; never themself */
    private function lead(StaffMember $entry): ?array
    {
        $own = $entry->getStation()?->getLead();

        if (null !== $own && $own !== $entry) {
            return ['name' => $own->getFullName(), 'phone' => $own->getMobile(), 'floor' => false];
        }

        $floor = $this->staffMemberRepository->findOneBy(['event' => $entry->getEvent(), 'floorLead' => true]);

        return null === $floor || $floor === $entry ? null : ['name' => $floor->getFullName(), 'phone' => $floor->getMobile(), 'floor' => true];
    }

    /** @return list<array{at: string, title: string, for: 'guests'|'staff'}> planned times, skipped moments left out */
    private function timing(Event $event, DateTimeZone $zone): array
    {
        $items = Vec\filter($this->scheduleItemRepository->findOnEvent($event), static fn (ScheduleItem $item): bool => !$item->isSkipped());
        $moments = Vec\map($items, static fn (ScheduleItem $item): array => [
            'at' => LocalTimeResolver::resolve($item->getStartsAt(), $zone)->setTimezone($zone),
            'title' => $item->getTitle(),
            'for' => $item->isShownToGuests() ? 'guests' : 'staff',
        ]);

        return Vec\map(
            Vec\sort($moments, static fn (array $a, array $b): int => $a['at'] <=> $b['at']),
            static fn (array $moment): array => [...$moment, 'at' => $moment['at']->format(\DATE_ATOM)],
        );
    }

    /** @return list<array{name: string, guests: list<array<string, mixed>>}>|null names and dietary needs alone, and only once doors are open */
    private function tables(?StaffStation $station, bool $open): ?array
    {
        $section = $station?->getSection();

        if (null === $section) {
            return null;
        }

        if (!$open) {
            return [];
        }

        $tables = Vec\filter($this->seatingTableRepository->findInPlan($section->getPlan()), static fn (SeatingTable $table): bool => $table->getSection() === $section);
        $seated = Dict\map(
            Dict\from_entries(Vec\map($tables, static fn (SeatingTable $table): array => [$table->getId()->toRfc4122(), $table])),
            fn (SeatingTable $table): array => Vec\filter(
                Vec\map($this->seatAssignmentRepository->findAt($table->getId()), static fn (SeatAssignment $seat): Guest => $seat->getGuest()),
                static fn (Guest $guest): bool => !$guest->isRemoved() && null !== $guest->getFullName(),
            ),
        );
        $needs = Dict\group_by(
            Vec\filter($this->guestNeedRepository->findFor(Vec\flatten(Vec\values($seated))), static fn (GuestNeed $need): bool => NeedKind::Access !== $need->getKind()),
            static fn (GuestNeed $need): string => $need->getGuest()->getId()->toRfc4122(),
        );

        return Vec\map($tables, static fn (SeatingTable $table): array => [
            'name' => $table->getName(),
            'guests' => Vec\map($seated[$table->getId()->toRfc4122()] ?? [], static fn (Guest $guest): array => self::guest($guest, $needs[$guest->getId()->toRfc4122()] ?? [])),
        ]);
    }

    /**
     * @param list<GuestNeed> $needs
     *
     * @return array{name: ?string, allergens: list<string>, diets: list<string>, otherAllergy: ?string, otherDiet: ?string}
     */
    private static function guest(Guest $guest, array $needs): array
    {
        $codes = static fn (NeedKind $kind): array => Vec\map(Vec\filter($needs, static fn (GuestNeed $need): bool => $need->getKind() === $kind), static fn (GuestNeed $need): string => $need->getCode());
        $allergens = $codes(NeedKind::Allergen);
        $diets = $codes(NeedKind::Diet);

        return [
            'name' => $guest->getFullName(),
            'allergens' => $allergens,
            'diets' => $diets,
            'otherAllergy' => Iter\contains($allergens, NeedKind::OTHER) ? $guest->getOther(NeedKind::Allergen) : null,
            'otherDiet' => Iter\contains($diets, NeedKind::OTHER) ? $guest->getOther(NeedKind::Diet) : null,
        ];
    }
}
