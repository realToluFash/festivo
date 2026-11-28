<?php

declare(strict_types=1);

namespace App\Domain\Seating\Numbers;

use App\Domain\Guest\Headcount\HeadcountCalculator;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\SeatAssignment;
use App\Repository\SeatAssignmentRepository;
use App\Repository\SeatingPlanRepository;
use App\Repository\SeatingRowRepository;
use App\Repository\SeatingSeatRepository;
use App\Repository\SeatingSectionRepository;
use App\Repository\SeatingTableRepository;
use Psl\Iter;
use Psl\Vec;

/**
 * The room in numbers (sc-103), derived on every read and never stored. `reason` is a value for the consumer to word.
 *
 * @phpstan-import-type Breakdown from SeatingTally
 */
final readonly class SeatingNumbers
{
    public const string NO_SEATING_PLAN = 'no_seating_plan';

    public const string NOTHING_TO_SIT_AT_YET = 'nothing_to_sit_at_yet';

    public function __construct(
        private HeadcountCalculator $headcountCalculator,
        private SeatingPlanRepository $seatingPlanRepository,
        private SeatingSectionRepository $seatingSectionRepository,
        private SeatingTableRepository $seatingTableRepository,
        private SeatingRowRepository $seatingRowRepository,
        private SeatingSeatRepository $seatingSeatRepository,
        private SeatAssignmentRepository $seatAssignmentRepository,
    ) {
    }

    /**
     * @return array{reason: ?string, plan: Breakdown, sections: list<array{id: string, name: string, counts: Breakdown}>, noSection: Breakdown, people: array{coming: int, comingAndSeated: int, withoutSeat: int}}
     */
    public function of(Event $event): array
    {
        $coming = $this->headcountCalculator->coming($event);
        $plan = $this->seatingPlanRepository->findOneForEvent($event);

        if (null === $plan) {
            return [
                'reason' => self::NO_SEATING_PLAN,
                'plan' => SeatingTally::none(),
                'sections' => [],
                'noSection' => SeatingTally::none(),
                'people' => ['coming' => Iter\count($coming), 'comingAndSeated' => 0, 'withoutSeat' => 0],
            ];
        }

        $assignments = $this->seatAssignmentRepository->findInPlan($plan);
        $tally = SeatingTally::of(
            $this->seatingSectionRepository->findInPlan($plan),
            $this->seatingTableRepository->findInPlan($plan),
            $this->seatingRowRepository->findInPlan($plan),
            $this->seatingSeatRepository->findInPlan($plan),
            $assignments,
        );
        $seatedIds = Vec\map($assignments, static fn (SeatAssignment $at): string => $at->getGuest()->getId()->toRfc4122());
        $comingAndSeated = Iter\count(Vec\filter($coming, static fn (Guest $person): bool => Iter\contains($seatedIds, $person->getId()->toRfc4122())));
        $empty = 0 === $tally['plan']['tables'] + $tally['plan']['rows'] + $tally['plan']['singleSeats'];

        return [
            'reason' => $empty ? self::NOTHING_TO_SIT_AT_YET : null,
            ...$tally,
            'people' => ['coming' => Iter\count($coming), 'comingAndSeated' => $comingAndSeated, 'withoutSeat' => Iter\count($coming) - $comingAndSeated],
        ];
    }
}
