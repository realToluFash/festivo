<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Entity\Event;
use App\Entity\SeatingPlan;
use App\Entity\SeatingRow;
use App\Entity\SeatingSeat;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Entity\User;
use App\Repository\SeatingPlanRepository;
use App\Repository\SeatingRowRepository;
use App\Repository\SeatingSeatRepository;
use App\Repository\SeatingSectionRepository;
use App\Repository\SeatingTableRepository;
use Doctrine\ORM\EntityManagerInterface;

/** A duplicated event's room, sections, tables, rows and single seats, with nobody seated (sc-3998, sc-3593, sc-4000, sc-4003); the duplicator flushes. */
final readonly class SeatingPlanCopier
{
    public function __construct(
        private SeatingPlanRepository $seatingPlanRepository,
        private SeatingSectionRepository $seatingSectionRepository,
        private SeatingTableRepository $seatingTableRepository,
        private SeatingRowRepository $seatingRowRepository,
        private SeatingSeatRepository $seatingSeatRepository,
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

        $sections = [];

        foreach ($this->seatingSectionRepository->findInPlan($plan) as $section) {
            $sections[$section->getId()->toRfc4122()] = new SeatingSection($copied, $section->getName(), $section->getNameKey(), $section->getColour(), $by);
            $this->entityManager->persist($sections[$section->getId()->toRfc4122()]);
        }

        foreach ($this->seatingTableRepository->findInPlan($plan) as $table) {
            $copy = new SeatingTable($copied, $table->getName(), $table->getNameKey(), $table->getShape(), $table->getXCm(), $table->getYCm(), $by);
            $copy->lay($table->getShape(), $table->getSeats(), $table->getWidthCm(), $table->getLengthCm(), $table->getEndSeats(), $table->getRotation(), $table->getUnusableSeats());
            $sectionId = $table->getSection()?->getId()->toRfc4122();
            $copy->setSection(null === $sectionId ? null : $sections[$sectionId] ?? null);
            $this->entityManager->persist($copy);
        }

        foreach ($this->seatingRowRepository->findInPlan($plan) as $row) {
            $copiedRow = new SeatingRow($copied, $row->getLabel(), $row->getLabelKey(), $row->getXCm(), $row->getYCm(), $by);
            $copiedRow->lay($row->getSeats(), $row->getSpacingCm(), $row->getRotation(), $row->getUnusableSeats());
            $sectionId = $row->getSection()?->getId()->toRfc4122();
            $copiedRow->setSection(null === $sectionId ? null : $sections[$sectionId] ?? null);
            $this->entityManager->persist($copiedRow);
        }

        foreach ($this->seatingSeatRepository->findInPlan($plan) as $seat) {
            $copiedSeat = new SeatingSeat($copied, $seat->getName(), $seat->getNameKey(), $seat->getXCm(), $seat->getYCm(), $by);
            $copiedSeat->setUnusable($seat->isUnusable());
            $sectionId = $seat->getSection()?->getId()->toRfc4122();
            $copiedSeat->setSection(null === $sectionId ? null : $sections[$sectionId] ?? null);
            $this->entityManager->persist($copiedSeat);
        }
    }
}
