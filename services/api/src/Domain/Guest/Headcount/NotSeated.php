<?php

declare(strict_types=1);

namespace App\Domain\Guest\Headcount;

use App\Domain\Messaging\Interfaces\NotSeatedInterface;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\SeatAssignment;
use App\Repository\SeatAssignmentRepository;
use App\Repository\SeatingPlanRepository;
use Psl\Iter;
use Psl\Vec;

final readonly class NotSeated implements NotSeatedInterface
{
    public function __construct(
        private HeadcountCalculator $headcountCalculator,
        private SeatingPlanRepository $seatingPlanRepository,
        private SeatAssignmentRepository $seatAssignmentRepository,
    ) {
    }

    public function people(Event $event): array
    {
        if (null === $this->seatingPlanRepository->findOneForEvent($event)) {
            return [];
        }

        $coming = $this->headcountCalculator->coming($event);
        $seated = Vec\map($this->seatAssignmentRepository->findOfGuests($coming), static fn (SeatAssignment $assignment): Guest => $assignment->getGuest());

        return Vec\filter($coming, static fn (Guest $person): bool => !Iter\contains($seated, $person));
    }
}
