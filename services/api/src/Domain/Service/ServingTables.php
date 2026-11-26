<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Domain\Service\Model\ServingTable;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\SeatAssignment;
use App\Entity\SeatingRow;
use App\Entity\SeatingSeat;
use App\Entity\SeatingTable;
use App\Repository\SeatAssignmentRepository;
use App\Repository\SeatingPlanRepository;
use App\Repository\SeatingRowRepository;
use App\Repository\SeatingSeatRepository;
use App\Repository\SeatingTableRepository;
use Collator;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** The event's tables as a tray sees them (sc-4005): each table and each row, and a section's single seats in label order, numbers by value, ten to a block. */
final readonly class ServingTables
{
    public const int BLOCK = 10;

    public function __construct(
        private SeatingPlanRepository $seatingPlanRepository,
        private SeatingTableRepository $seatingTableRepository,
        private SeatingRowRepository $seatingRowRepository,
        private SeatingSeatRepository $seatingSeatRepository,
        private SeatAssignmentRepository $seatAssignmentRepository,
    ) {
    }

    /** @return list<ServingTable> tables, then rows, then blocks */
    public function of(Event $event): array
    {
        $plan = $this->seatingPlanRepository->findOneForEvent($event);

        if (null === $plan) {
            return [];
        }

        $at = Dict\group_by($this->seatAssignmentRepository->findInPlan($plan), static fn (SeatAssignment $one): string => $one->getPlaceId()->toRfc4122());
        $inSeatOrder = static fn (string $placeId): array => Vec\map(
            Vec\sort_by($at[$placeId] ?? [], static fn (SeatAssignment $one): int => $one->getSeat()),
            static fn (SeatAssignment $one): array => ['guest' => $one->getGuest(), 'seat' => (string) $one->getSeat()],
        );

        $tables = Vec\map($this->seatingTableRepository->findInPlan($plan), static fn (SeatingTable $table): ServingTable => new ServingTable(
            'table:' . $table->getId()->toRfc4122(),
            'table',
            $table->getName(),
            [],
            $table->getSection(),
            $inSeatOrder($table->getId()->toRfc4122()),
        ));
        $rows = Vec\map($this->seatingRowRepository->findInPlan($plan), static fn (SeatingRow $row): ServingTable => new ServingTable(
            'row:' . $row->getId()->toRfc4122(),
            'row',
            $row->getLabel(),
            [],
            $row->getSection(),
            $inSeatOrder($row->getId()->toRfc4122()),
        ));

        return [...$tables, ...$rows, ...self::blocks($this->seatingSeatRepository->findInPlan($plan), $at)];
    }

    public function find(Event $event, string $key): ?ServingTable
    {
        return Iter\search($this->of($event), static fn (ServingTable $one): bool => $one->key === $key);
    }

    public function ofGuest(Event $event, Guest $guest): ?ServingTable
    {
        return Iter\search($this->of($event), static fn (ServingTable $one): bool => Iter\any($one->guests, static fn (array $at): bool => $at['guest']->getId()->equals($guest->getId())));
    }

    /**
     * @param list<SeatingSeat>                   $seats
     * @param array<string, list<SeatAssignment>> $at    by place id
     * @return list<ServingTable>
     */
    public static function blocks(array $seats, array $at): array
    {
        $collator = new Collator('root');
        $collator->setAttribute(Collator::NUMERIC_COLLATION, Collator::ON);
        $bySection = Dict\group_by($seats, static fn (SeatingSeat $seat): string => $seat->getSection()?->getId()->toRfc4122() ?? 'none');
        $blocks = [];

        foreach ($bySection as $section => $theirs) {
            $ordered = Vec\sort($theirs, static fn (SeatingSeat $a, SeatingSeat $b): int => (int) $collator->compare($a->getName(), $b->getName()));

            foreach (Vec\chunk($ordered, self::BLOCK) as $index => $block) {
                $blocks[] = new ServingTable(
                    'block:' . $section . ':' . ($index + 1),
                    'block',
                    null,
                    Vec\map($block, static fn (SeatingSeat $seat): string => $seat->getName()),
                    $block[0]->getSection(),
                    Vec\flat_map($block, static fn (SeatingSeat $seat): array => Vec\map(
                        $at[$seat->getId()->toRfc4122()] ?? [],
                        static fn (SeatAssignment $one): array => ['guest' => $one->getGuest(), 'seat' => $seat->getName()],
                    )),
                );
            }
        }

        return $blocks;
    }
}
