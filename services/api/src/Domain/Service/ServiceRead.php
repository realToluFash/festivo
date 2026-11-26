<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Menu\Interfaces\ServingStationsInterface;
use App\Domain\Service\Model\ServingTable;
use App\Domain\Staff\RosterNames;
use App\Domain\Staff\Station\ServiceTables;
use App\Entity\Guest;
use App\Entity\MenuCourse;
use App\Entity\ServiceFiring;
use App\Entity\ServiceItem;
use App\Entity\ServicePlate;
use App\Entity\ServiceTray;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\ItemState;
use App\Enum\NoOrderReason;
use App\Http\Access\Grants;
use App\Repository\ServiceFiringRepository;
use App\Repository\ServiceItemRepository;
use App\Repository\ServicePlateRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** @phpstan-type Viewer array{grants: Grants, user: User} */
final readonly class ServiceRead
{
    public function __construct(
        private ServingTables $servingTables,
        private ServingStationsInterface $servingStations,
        private ServiceTables $serviceTables,
        private RosterNames $rosterNames,
        private GuestNeedsRecord $guestNeedsRecord,
        private ServiceFiringRepository $serviceFiringRepository,
        private ServiceItemRepository $serviceItemRepository,
        private ServicePlateRepository $servicePlateRepository,
        private TrayRead $trayRead,
        private ServicePhases $servicePhases,
        private ClockInterface $clock,
    ) {
    }

    /** @param ?Viewer $viewer */
    public function of(MenuCourse $course, ?array $viewer): array
    {
        $event = $course->getEvent();
        $stations = $this->servingStations->of($event);
        $stops = Dict\from_entries(Vec\map($stations['stops'], static fn (array $stop): array => [$stop['id'], $stop]));
        $passId = $stations['stops'][0]['id'];
        $stopOf = TrayRead::stopsByItem($stations['courses'], $passId);
        $states = $this->states($course);
        $plates = $this->servicePlateRepository->findOfCourse($course);
        $trays = $this->trayRead->trays($plates);
        $nameOf = $this->rosterNames->of($event);
        $onTrays = $this->servicePlateRepository->findOnTrays($trays);
        $firings = Dict\from_entries(Vec\map($this->serviceFiringRepository->findOfCourse($course), static fn (ServiceFiring $one): array => [$one->getTableKey(), $one]));
        $tables = $this->servingTables->of($event);
        $guests = Vec\flat_map($tables, static fn (ServingTable $table): array => Vec\map($table->guests, static fn (array $at): Guest => $at['guest']));
        $needs = [] === $guests ? [] : $this->guestNeedsRecord->of($guests);
        $ordersByGuest = Dict\from_entries(Vec\map(Vec\filter($plates, static fn (ServicePlate $plate): bool => $plate->isOrder()), static fn (ServicePlate $plate): array => [$plate->getGuest()->getId()->toRfc4122(), $plate]));
        $owedByGuest = Dict\group_by(Vec\filter($plates, static fn (ServicePlate $plate): bool => !$plate->isOrder()), static fn (ServicePlate $plate): string => $plate->getGuest()->getId()->toRfc4122());
        $carriedBy = [];

        foreach ($onTrays as $plate) {
            $carriedBy[$plate->getGuest()->getId()->toRfc4122()][] = $plate->getTray()?->getWaiter()->getId()->toRfc4122();
        }

        $tableReads = Vec\map($tables, function (ServingTable $table) use ($course, $viewer, $states, $firings, $needs, $ordersByGuest, $owedByGuest, $carriedBy): array {
            $people = $this->serviceTables->onSection($table->section);
            $namesHere = null !== $viewer && $this->serviceTables->mayWriteAt($viewer['grants'], $viewer['user'], $table->section);
            $firing = $firings[$table->key] ?? null;
            $theirs = Vec\filter_nulls(Vec\map($table->guests, static fn (array $at): ?ServicePlate => $ordersByGuest[$at['guest']->getId()->toRfc4122()] ?? null));

            return [
                'key' => $table->key,
                'kind' => $table->kind,
                'name' => $table->name,
                'seats' => $table->seats,
                'section' => null === $table->section ? null : ['id' => $table->section->getId()->toRfc4122(), 'name' => $table->section->getName()],
                'people' => Vec\map($people, static fn (StaffMember $one): array => ['id' => $one->getId()->toRfc4122(), 'name' => $one->getFullName()]),
                'firedAt' => $firing?->getFiredAt()->format(\DATE_RFC3339_EXTENDED),
                'guests' => Vec\map($table->guests, function (array $at) use ($viewer, $namesHere, $states, $firing, $needs, $ordersByGuest, $owedByGuest, $carriedBy): array {
                    $guest = $at['guest'];
                    $id = $guest->getId()->toRfc4122();
                    $order = $ordersByGuest[$id] ?? null;
                    $named = $namesHere || (null !== $viewer && Iter\contains($carriedBy[$id] ?? [], $viewer['user']->getId()->toRfc4122()));

                    return [
                        'id' => $id,
                        'seat' => $at['seat'],
                        'name' => $named ? $guest->getFullName() : null,
                        'flags' => ServiceRules::flags($needs[$id] ?? GuestNeeds::none()),
                        'order' => null === $order ? null : $this->order($order, $states, $owedByGuest[$id] ?? []),
                        'noOrder' => null !== $order ? null : self::noOrder($guest, $firing)?->value,
                    ];
                }),
                'plates' => $this->queue($course, $table, $states),
                'counts' => ServiceCounts::of($theirs, $states),
                'waitingSince' => ServiceCounts::waitingSince($theirs),
            ];
        });

        return [
            'course' => ['id' => $course->getId()->toRfc4122(), 'name' => $course->getName()],
            'items' => $this->items($course, $stations['courses'], $stops, $passId, $states, $plates),
            'tables' => $tableReads,
            'trays' => Vec\map($trays, fn (ServiceTray $tray): array => $this->trayRead->tray($tray, $onTrays, $stations['stops'], $stopOf, $passId, $nameOf)),
            'sections' => ServiceCounts::bySection($tableReads),
            'counts' => ServiceCounts::of(Vec\filter($plates, static fn (ServicePlate $plate): bool => $plate->isOrder()), $states),
            // Not in a patch: it moves with the clock and the event, and a device learns it from the heartbeat and its reads (sc-4028).
            ...(null === $viewer ? [] : ['phase' => $this->servicePhases->of($event, $this->clock->now())->value]),
        ];
    }

    /** @return array<string, ItemState> the course's items by key; one not there is Ready */
    public function states(MenuCourse $course): array
    {
        return Dict\from_entries(Vec\map($this->serviceItemRepository->findOfCourse($course), static fn (ServiceItem $item): array => [$item->getItemKey(), $item->getState()]));
    }

    /**
     * @param list<array{course: MenuCourse, items: list<array{name: string, key: string, stop: string}>}> $courses
     * @param array<string, array{id: string, name: string}>                                               $stops
     * @param array<string, ItemState>                                                                     $states
     * @param list<ServicePlate>                                                                           $plates
     */
    private function items(MenuCourse $course, array $courses, array $stops, string $passId, array $states, array $plates): array
    {
        $entry = Iter\search($courses, static fn (array $one): bool => $one['course']->getId()->equals($course->getId()));
        $items = Vec\map($entry['items'] ?? [], static fn (array $item): array => ['key' => $item['key'], 'name' => $item['name'], 'stop' => $item['stop']]);

        if (Iter\any($plates, static fn (ServicePlate $plate): bool => Iter\any($plate->getItems(), static fn (array $item): bool => OrderMaker::CHEFS_CHOICE === $item['key']))) {
            $items[] = ['key' => OrderMaker::CHEFS_CHOICE, 'name' => null, 'stop' => $passId];
        }

        $rows = Dict\from_entries(Vec\map($this->serviceItemRepository->findOfCourse($course), static fn (ServiceItem $item): array => [$item->getItemKey(), $item]));

        return Vec\map($items, static function (array $item) use ($stops, $states, $rows): array {
            $row = $rows[$item['key']] ?? null;

            return [
                'id' => $row?->getId()->toRfc4122(),
                'key' => $item['key'],
                'name' => $item['name'],
                'station' => $stops[$item['stop']] ?? null,
                'state' => ($states[$item['key']] ?? ItemState::Ready)->value,
                'readyIn' => $row?->getReadyIn(),
                'changedAt' => $row?->getChangedAt()?->format(\DATE_RFC3339_EXTENDED),
                'changedBy' => $row?->getChangedBy()?->getId()->toRfc4122(),
                'preparingSince' => $row?->getPreparingSince()?->format(\DATE_RFC3339_EXTENDED),
            ];
        });
    }

    /**
     * @param array<string, ItemState> $states
     * @param list<ServicePlate>       $owed
     */
    private function order(ServicePlate $order, array $states, array $owed): array
    {
        $held = ServiceRules::isHeld($order, $states);
        $preparing = ServiceRules::preparing($order, $states);

        return [
            ...$this->plate($order, $states),
            'held' => $held,
            'holding' => $held ? $preparing : [],
            'choice' => $order->getChoice()?->value,
            'owed' => Vec\map($owed, fn (ServicePlate $plate): array => $this->plate($plate, $states)),
        ];
    }

    /** @param array<string, ItemState> $states */
    private function plate(ServicePlate $plate, array $states): array
    {
        return [
            'id' => $plate->getId()->toRfc4122(),
            'guestId' => $plate->getGuest()->getId()->toRfc4122(),
            'courseId' => $plate->getCourse()->getId()->toRfc4122(),
            'isOrder' => $plate->isOrder(),
            'stage' => $plate->getStage()->value,
            'items' => Vec\map($plate->getItems(), static fn (array $item): array => [...$item, 'state' => ($states[$item['key']] ?? ItemState::Ready)->value]),
            'variant' => $plate->getVariant(),
            'toFollow' => $plate->getToFollow(),
            'trayId' => $plate->getTray()?->getId()->toRfc4122(),
            'steps' => $plate->getSteps(),
            'owedReason' => $plate->getOwedReason()?->value,
            'owedAt' => $plate->getOwedAt()?->format(\DATE_RFC3339_EXTENDED),
            'sentBack' => Vec\map($plate->getSentBack(), static fn (array $one): array => ['reason' => $one['reason'], 'at' => $one['at'], 'by' => $one['by']]),
        ];
    }

    /** @param array<string, ItemState> $states */
    private function queue(MenuCourse $course, ServingTable $table, array $states): array
    {
        return Vec\map(
            $this->waiting($course, $table, $states),
            fn (ServicePlate $plate): array => $this->plate($plate, $states),
        );
    }

    /**
     * @param array<string, ItemState> $states
     *
     * @return list<ServicePlate>
     */
    public function waiting(MenuCourse $course, ServingTable $table, array $states): array
    {
        $atTable = $this->servicePlateRepository->findAtTable($course->getEvent(), $table->key);
        $statesOf = [$course->getId()->toRfc4122() => $states];
        $stateFor = function (ServicePlate $plate) use (&$statesOf): array {
            $id = $plate->getCourse()->getId()->toRfc4122();

            return $statesOf[$id] ??= $this->states($plate->getCourse());
        };
        $owed = Vec\sort_by(
            Vec\filter($atTable, static fn (ServicePlate $plate): bool => $plate->isOwed() && ServiceRules::isWaiting($plate, $stateFor($plate))),
            static fn (ServicePlate $plate): string => ($plate->getOwedAt()?->format('U.u') ?? '') . $plate->getId()->toRfc4122(),
        );
        $seatOrder = Dict\flip(Vec\map($table->guests, static fn (array $at): string => $at['guest']->getId()->toRfc4122()));
        $orders = Vec\sort_by(
            Vec\filter($atTable, static fn (ServicePlate $plate): bool => !$plate->isOwed() && $plate->getCourse() === $course && ServiceRules::isWaiting($plate, $states)),
            static fn (ServicePlate $plate): int => $seatOrder[$plate->getGuest()->getId()->toRfc4122()] ?? \PHP_INT_MAX,
        );

        return [...$owed, ...$orders];
    }

    private static function noOrder(Guest $guest, ?ServiceFiring $firing): ?NoOrderReason
    {
        if (!$guest->hasArrived()) {
            return NoOrderReason::NotHereYet;
        }

        return null === $firing ? null : NoOrderReason::NothingForThisCourse;
    }
}
