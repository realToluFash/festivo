<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Entity\Event;
use App\Entity\SeatingPlan;
use App\Entity\SeatingSection;
use App\Entity\User;
use App\Repository\SeatingPlanRepository;
use App\Repository\SeatingSectionRepository;
use Doctrine\ORM\EntityManagerInterface;

/** A duplicated event's room and sections, with nobody seated (sc-3998, sc-3593); the duplicator flushes. */
final readonly class SeatingPlanCopier
{
    public function __construct(
        private SeatingPlanRepository $seatingPlanRepository,
        private SeatingSectionRepository $seatingSectionRepository,
        private EntityManagerInterface $entityManager,
    ) {
    }

    public function copy(Event $original, Event $copy, User $by): void
    {
        $plan = $this->seatingPlanRepository->findOneForEvent($original);

        if (null === $plan) {
            return;
        }

        $copied = new SeatingPlan($copy, $plan->getRoomName(), $plan->getWidthCm(), $plan->getLengthCm(), $by);
        $this->entityManager->persist($copied);

        foreach ($this->seatingSectionRepository->findInPlan($plan) as $section) {
            $this->entityManager->persist(new SeatingSection($copied, $section->getName(), $section->getNameKey(), $section->getColour(), $by));
        }
    }
}
